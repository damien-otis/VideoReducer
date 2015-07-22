angular.module("ddCtrl").service("ffmpegService",['folderService',function(folderService){

	var self = this

	self.compression_profile = '-loglevel 32 -y -acodec mp2 -ac 2 -vcodec mpeg4 -vb 5000k -r 29.97 -s 1280x720 -aspect 16:9 -ab 128000 -ar 44100 -vsync 1 -async 1 -threads 16 ';

	self.deleteFile = function(path,callback){
	    fs.unlink(path,function(err,status){
		    if (callback){callback(path)}
	    })
	 }

	 self.kill = function(){
		 if (self.current_process){
			 self.current_process.kill('SIGINT');
			 self.current_process = undefined;
			 fs.unlinkSync(self.current_output_file)
		 }
	 };

	 self.processFile = function(path,callback,progress){

		 var outpath = path.split(".").slice(0,-1).join(".")+"[packed].mp4";

		 if (fs.existsSync(outpath)){
console.log("exists");
			 callback();
			 return
		 }
		 var childArgs =  [].concat('-i',path,self.compression_profile.split(" "),outpath);
		 var binPath = cwd+"\\ffmpeg\\ffmpeg.exe";

		 self.current_output_file = outpath;

		 self.current_process = exec.execFile(binPath, childArgs, {"timeout":0,"maxBuffer":99999999999},function(err, stdout, stderr) {
			 self.current_output_file = undefined;
			 self.current_process = undefined;
			if (err){
				var ext = path.split(".").pop();
				var nopack = path.split(".").slice(0,-1).join(".")+"[nopack]."+ext;
				folderService.encoding_exceptions.push(nopack);
				fs.rename(path,nopack,function(){
					if(callback){
						callback(err,stdout,stderr)
					}
				});
			} else{
				self.deleteFile(path,function(){
					if(callback){
						callback(err,stdout,stderr)
					}
				});
			}
		 });

		 self.current_process.on("exit",function(){
console.log("EXIT",arguments)
		 })

		 self.current_process.stdout.on("data", function (data) {
console.log("stdout",data)
		 });

		 self.current_process.stderr.on("data", function (data) {

			 if (data.indexOf("frame=")==-1) {
				 return
			 }

			 var frame = parseInt(data.split("frame=")[1].split("fps")[0].replace(/\s/g,""),10);
			 var fps = parseInt(data.split("fps=")[1].split("q")[0].replace(/\s/g,""),10);
			 var size = data.split("size=")[1].split("time")[0].replace(/\s/g,"");
			 var time = data.split("time=")[1].split("bitrate")[0].replace(/\s/g,"");
			 var bitrate = data.split("bitrate=")[1].split("dup")[0].replace(/\s/g,"");

			 var time_arr = time.split(":");
			 var seconds = (parseInt(time_arr[0],10) * 60 * 60) + (parseInt(time_arr[1],10) * 60) + (parseFloat(time_arr[2]))

			 var progress_data ={
			    frame   : frame,
			    fps     : fps,
			    size    : size,
			    seconds : seconds,
			    bitrate : bitrate
		    };

			 if (progress){progress(progress_data)}

		 })
	 };

	//-------------------------------------------------------------------------------------------------------------------------------

	 self.getFileStats = function(path,callback){
		 var binPath = cwd+"\\ffmpeg\\ffprobe.exe";
		 var childArgs =  '-v quiet -print_format json -show_format -show_streams'.split(" ").concat([path]);
		 exec.execFile(binPath, childArgs, {"timeout":99999,"maxBuffer":99999999999},function(err, stdout, stderr) {
console.log("ffprobe",err, stdout, stderr)
			if (err){
				folderService.encoding_exceptions.push(path)
				callback({})
				return
			}
			 var media_info=JSON.parse(stdout)
			 if (!err && media_info.format){
				 if(media_info.format.duration){
					 media_info.format.duration=parseFloat(media_info.format.duration);
					 media_info.format.size=parseFloat(media_info.format.size);
					 media_info.format.bit_rate=parseFloat(media_info.format.bit_rate);
				 }
				 callback(media_info)
			 } else {
				 folderService.encoding_exceptions.push(path)
				 callback({})
			 }
		 })
	 };

	//-------------------------------------------------------------------------------------------------------------------------------
}]);
