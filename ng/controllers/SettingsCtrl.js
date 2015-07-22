angular.module("ddCtrl").controller("SettingsCtrl", ['$scope', '$rootScope', '$state', '$http', '$window','folderService','ffmpegService', function($scope, $rootScope, $state, $http, $window,  folderService, ffmpegService ){

	$scope.folderService = folderService;

	$scope.filetypes = folderService.filetypes

	$scope.ffmpegService = ffmpegService

	var unbindDropEventHandler = $rootScope.$on("dragDropFiles_over",function(){
		console.log("dragDropFiles_over")
		$state.go("home");
	})

	$scope.$on("$destroy",function(){
		$("._720kb-tooltip").remove()
		unbindDropEventHandler();
	});


}]);

