angular.module("ddCtrl").controller("HomeCtrl", ['$scope', '$rootScope', '$state', '$http', '$window', 'folderService', '$timeout', 'ffmpegService', function($scope, $rootScope, $state, $http, $window, folderService, $timeout, ffmpegService){

	$scope.folderService = folderService;

	$scope.ffmpegService = ffmpegService;

	$scope.filetypes = folderService.filetypes;

	//*****************************************************************************************************
//	if (self.hasWatching = false;

	folderService.init(function(config){
		if (folderService.initialize_completed){
			processNextFile();
		}
		if (config){
			startTimer(config)
		}
		$scope.$apply();
	},$scope);

	//*****************************************************************************************************

	function startTimer(config){
		clearTimeout(config.tmr);
		config.tmr = setTimeout(function(){
			folderService.newWatch(config.path,config,function(){
				startTimer(config);
				processNextFile();
				$scope.$apply();
			},$scope);
		},config.frequency);
	}

	$scope.$on("$destroy",function(){
		unbindDropEventHandler();
	});

	$scope.$on("close_program",function(callback){
		if (folderService.current_file && ffmpegService.current_process){
			ffmpegService.current_process.kill();
		}
console.log("callback",callback)
		callback()
	});

	var unbindDropEventHandler = $rootScope.$on("dragDropFiles_drop",function(obj,files){
console.log("dragDropFiles_drop");
		var already_watched = [];
		newpaths:for (var i=0;i<files.length;i++){
			var newpath=files[i].path;
			for(var watch in folderService.watching){
				var watchpath=folderService.watching[watch].path;
				if(newpath.indexOf(watchpath)===0){
					already_watched.push(newpath);
					continue newpaths
				}
			}

			folderService.newWatch(files[i].path,undefined,function(config){
				startTimer(config);
				processNextFile();
				$scope.$apply();
			},$scope);
		}
		if (already_watched.length>0){
			sweetAlert("Already being watched:",already_watched.join("\n"))
		}
	});

	//*****************************************************************************************************

	function processNextFile(){
		if (folderService.current_file){
			if (!process_is_testing){testFiles()}
			return
		}

		process_is_testing = true

		var nextfile = folderService.getNextFile();
		if (!nextfile){
			folderService.current_file = undefined;
			$scope.$apply();
			return
		}

		$scope.$apply();

		var existing_file = nextfile.path.split(".").slice(0,-1).join(".")+"[packed].mp4";

		fs.exists(existing_file,function(exists){
			if (exists){
				folderService.current_file = undefined;
				$scope.progress_completed = undefined;
				processNextFile();
				$scope.$apply();
			} else {
				ffmpegService.getFileStats(nextfile.path,function(media_info){
					if (!media_info.format) {
						var ext = nextfile.path.split(".").pop();
						var nopack = nextfile.path.split(".").slice(0,-1).join(".")+"[nopack]."+ext;
						fs.rename(nextfile.path,nopack,function(){
							folderService.current_file = undefined;
							$scope.progress_completed = undefined;
							$scope.$apply();
							processNextFile();
						});
						return
					}

					nextfile.stream_info = media_info;

					$scope.$apply();

//					if (video_stream.stream_type && (video_stream.stream_width > 1280 || video_stream.stream_height > 720) ){
					var max_width = 0;
					var max_height = 0;
					for (var i=0;i<media_info.streams.length;i++){
						if (media_info.streams[i].width && media_info.streams[i].width > max_width) {
							max_width = media_info.streams[i].width
						}
						if (media_info.streams[i].height && media_info.streams[i].height > max_height) {
							max_height = media_info.streams[i].height
						}
					}

					if ( (max_width > 1280 || max_height > 720) && max_width < 3840 ){
						nextfile.processing = true;
						$scope.progress_completed = 0;
						ffmpegService.processFile(nextfile.path,function(){
							$scope.progress_completed = undefined;
							folderService.current_file = undefined;
							processNextFile();
							$scope.$apply();
						},function(progress_data){
							var percent = Math.max(0,Math.min(progress_data.seconds / media_info.format.duration , 1));
							$scope.progress_completed = percent;
							$scope.$apply();
						});
						$scope.$apply()
						process_is_testing = false
testFiles()						
					} else {
						folderService.files_rejected.push(nextfile);
						folderService.current_file = undefined;
						$scope.$apply();
						var ext = nextfile.path.split(".").pop();
						var nopack = nextfile.path.split(".").slice(0,-1).join(".")+"[nopack]."+ext;
						fs.rename(nextfile.path,nopack,function(){
							processNextFile();
						});
					}
				})
			}
		});

	}
	//*****************************************************************************************************
	var process_is_testing = false
	function testFiles(){
		if (process_is_testing) {return}

		if (folderService.allFilesGoodToPack()){return}

		var nextfile = folderService.shiftFileFromStack()
console.log("testFiles",nextfile)

		if (nextfile.good_to_pack){
			testFiles()
			return
		}

		ffmpegService.getFileStats(nextfile.path,function(media_info){
			if (!media_info.format) {
				var ext = nextfile.path.split(".").pop();
				var nopack = nextfile.path.split(".").slice(0,-1).join(".")+"[nopack]."+ext;
				fs.rename(nextfile.path,nopack,function(){
					$scope.$apply();
console.log("testFiles rejected no format: ",nextfile)
testFiles();
				});
				return
			}

			nextfile.stream_info = media_info;

			$scope.$apply();

//					if (video_stream.stream_type && (video_stream.stream_width > 1280 || video_stream.stream_height > 720) ){
			var max_width = 0;
			var max_height = 0;
			for (var i=0;i<media_info.streams.length;i++){
				if (media_info.streams[i].width && media_info.streams[i].width > max_width) {
					max_width = media_info.streams[i].width
				}
				if (media_info.streams[i].height && media_info.streams[i].height > max_height) {
					max_height = media_info.streams[i].height
				}
			}

			if ( (max_width > 1280 || max_height > 720) && max_width < 3840 ){
				nextfile.good_to_pack = true
				folderService.pushFileToStack(nextfile)

				$scope.$apply()
console.log("testFiles okay to process: ",nextfile)
testFiles()

			} else {

				folderService.files_rejected.push(nextfile);
				$scope.$apply();
				var ext = nextfile.path.split(".").pop();
				var nopack = nextfile.path.split(".").slice(0,-1).join(".")+"[nopack]."+ext;
				fs.rename(nextfile.path,nopack,function(){
console.log("testFiles rejected too small: ",nextfile)
testFiles();
				});

			}
		})		
	}
	//*****************************************************************************************************

	$scope.removeWatch = function(path){
		sweetAlert({
			title: "Are you sure?",
			text: "Removing "+path,
			type: "warning",
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Yes, delete it!",
			closeOnConfirm: true
		}, function(){
			folderService.removeWatch(path);
			$scope.$apply();
		});

		//	$timeout(function(){$scope.$apply()});
	};

	$scope.rescan = function(watchdata){
		folderService.newWatch(watchdata.path, watchdata, function(){
			startTimer(watchdata);
			processNextFile();
			$scope.$apply();
		},$scope)
	}

	//*****************************************************************************************************
	$scope.updatePriority = function(watchdata){
		if (watchdata.priority == ""){return}
		var filter = watchdata.priority.replace(/[^0-9]/g,"");
		if (filter != watchdata.priority){
			watchdata.priority = filter;
			return
		}
		if (String(watchdata.priority).length>5){watchdata.priority = parseInt(String(watchdata.priority).slice(0,5),10)}
		if (watchdata.priority == ""){return}

		folderService.saveWatchPaths();

		folderService.newWatch(watchdata.path, watchdata, function(){
			$scope.$apply();
		},$scope)

	};

	$scope.updateFrequency = function(watchdata){
		if (watchdata.frequency == ""){return}
		folderService.saveWatchPaths();
		startTimer(watchdata);
	};

}]);