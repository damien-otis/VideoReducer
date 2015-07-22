angular.module("ddCtrl").service("folderService",['$timeout',function($timeout) {
	var self = this;

	self.filetypes = ['avi','wmv','ts','mp4','mkv','m4v','mpeg','mpg','mov','qt'];

	self.files_to_process = [];

	self.files_rejected = [];

	self.watching = {};

	self.encoding_exceptions = [];

	var initialized = false;

	self.init = function(callback,scope){
		if(initialized){return}
		initialized = true;
		self.loadWatchPaths(function(data){
			var pathcount = 0;
			for (var obj in data){pathcount++}
			if (pathcount === 0){
				self.initialize_completed = true
				self.hasWatching = false;
				callback();
				return
			}
			for (var path in data){
				self.newWatch(path,data[path],function(config){
					pathcount--;
					if (pathcount === 0){
						self.initialize_completed = true
					}
					callback(config);
				},scope)
			}
		});
	};

	self.getNextFile = function(){
		return self.current_file = self.files_to_process.shift()
	};

	self.shiftFileFromStack = function(file){
		return self.files_to_process.shift()
	}

	self.pushFileToStack = function(file){
		self.files_to_process.push(file)
	}

	self.allFilesGoodToPack = function(){
		var all_files_good = true
		for (var i=0;i<self.files_to_process.length;i++){
			if (!self.files_to_process[i].good_to_pack){
				all_files_good = false
			}
		}
		return all_files_good
	}

	self.loadWatchPaths = function(callback){
		fs.readFile(cwd+"\\watchfolders.json",'utf8',function(err,data){
			if (err){
				callback({});
			} else {
				callback(JSON.parse(data));
			}
		})
	};

	self.configDiskSpace = function(config,callback){
		diskspace.check(config.drive,function(err,total,free,status){
			config.disk = {
				total_bytes     : total,
				free_bytes      : free,
				total_size      : prettyBytes(parseInt(total,10)),
				total_percent   : free / total,
				free_size       : prettyBytes(parseInt(free,10)),
				status          : status
			};
			//			config.scope.$apply();
			if (callback){callback(config)}
			//console.log("size",config.drive,"total=",total_size,"free=",free_size,"percent=",total_percent);
		})
	};

	self.newWatch = function(path,config,callback,scope){
		var create_watch = (config == undefined);
		config = config || {
			priority    : 10,
			frequency   : 300000
		};
		//config.scope = scope;

		if (!create_watch){
			clearTimeout(config.tmr);
		}

		config.path = path;
		config.filecount = 0;

		self.watching[path] = config;

		self.hasWatching = true;

		config.drive = path.split(":")[0];

		self.configDiskSpace(config,function(){
			scope.$apply();
		});

		config.loading = true;
		$timeout(function(){scope.$apply()});

		getFilesRecursiveAsync(path,addFiles,self.filetypes,fileCountProgress);

		function addFiles(files){

			var rejected = {};
			for (var i=0;i<self.files_rejected.length;i++){
				rejected[self.files_rejected[i].path] = self.files_rejected[i];
			}

			var keeping = {};
			for (var i=files.length-1;i>-1;i--){
				if (
					files[i].indexOf("[packed]")!=-1 ||
					files[i].indexOf("[nopack]")!=-1 ||
					rejected[files[i]]
				){
					files.splice(i,1)
				} else {
					keeping[files[i]] = true
				}
			}

			config.filecount = files.length;

			//make a map of all files in this so we can compare below
//			for (var i=0;i<files.length;i++){
//				keeping[files[i]] = true
//			}

			var tracking = {};
			//remove files not in this list that match this watch folder
			for (var i = self.files_to_process.length-1; i >- 1 ; i--){
				if (self.files_to_process[i].watchpath === path){
					if(keeping[self.files_to_process[i].path]===undefined){
						self.files_to_process.splice(i,1);
						continue
					}
					self.files_to_process[i].priority = parseInt(config.priority,10)
					tracking[self.files_to_process[i].path]=self.files_to_process[i]
				}
			}
			if (self.current_file){
				tracking[self.current_file.path]=self.current_file;
			}

			//add new files, skip any existing files
			findfile:for (var i=0;i<files.length;i++){
				if (tracking[files[i]]){
					continue findfile
				}
				self.files_to_process.push({
					path        : files[i],
					watchpath   : path,
					priority    : parseInt(config.priority,10)
				});
			}

			self.files_to_process.sort(function(a,b){
				if (a.priority < b.priority ){return -1}
				if (a.priority > b.priority ){return 1}
				if (a.path.toLowerCase() < b.path.toLowerCase()){return -1}
				if (a.path.toLowerCase() > b.path.toLowerCase()){return 1}
				return 0
			});

			config.loading = false;

			//			self.files.sort(function(a,b){
			//				return (a.priority <= b.priority) ? -1 : (a.priority >= b.priority) ? 1 : 0
			//			})

			if (callback){callback(config)}
			//console.log("newWatch",path,config.frequency)

		}

		if (create_watch){
			self.saveWatchPaths();
		}

		function fileCountProgress(progress){
			config.filecount = progress
			$timeout(function(){scope.$apply()});
		}
	};

	self.removeWatch = function(path){
		for (var i=self.files_to_process.length-1;i>-1;i--){
			if (self.files_to_process[i].watchpath === path) {
				self.files_to_process.splice(i,1)
			}
		}
		clearTimeout(self.watching[path].tmr);
		delete self.watching[path];
		self.saveWatchPaths();
		for (var iswatched in self.watching){}
		self.hasWatching = !!iswatched;
	};

	self.updatePriority = function(){
		self.saveWatchPaths();
	};
	self.updateFrequency = function(){
		self.saveWatchPaths();
	};

	var save_watch_tmr;
	self.saveWatchPaths = function(){
		clearTimeout(save_watch_tmr);
		save_watch_tmr = setTimeout(function(){
			fs.writeFile(cwd+"\\watchfolders.json",JSON.stringify(self.watching));
		},100)
	}

	//*****************************************************************************************************
	//non-blocking double-recursive list of files, with file extension matching - node.js
	//
	function getFilesRecursiveAsync(folder,callback,filetypes,progress){
		var files = [];
		function recurseFolders(thisfolder,thiscallback){
			fs.readdir(thisfolder,function(err,fold){
				var arr = [];
				if (!err && fold.length>0){
					iterateFiles();
				} else {
					thiscallback(files)
				}
				function iterateFiles(){
					var path = thisfolder + "\\" + fold.shift();
					fs.lstat(path,function(err,stats){
						if (!err){
							if (stats.isDirectory()){
								recurseFolders(path,endIterate)
							} else {
								if (!filetypes || (filetypes && filetypes.length > 0 && fileMatch(path)) ){
									arr.push(path);
								}
								endIterate();
							}
						} else {
							endIterate();
						}

						function endIterate(){
							if (fold.length>0){
								iterateFiles()
							} else {
								files = files.concat(arr);
								if (progress){progress(files.length)}
								thiscallback(files)
							}
						}
					})
				}
			});
		}
		recurseFolders(folder,callback);

		function fileMatch(file){
			var ext = file.split(".").pop().toLowerCase()
			for (var i=0;i<filetypes.length;i++){
				if (filetypes[i] == ext){
					return true
				}
			}
			return false
		}

	}


}]);