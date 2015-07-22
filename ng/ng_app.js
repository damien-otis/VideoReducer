var fs = require('fs');
var exec = require('child_process');
var path = require('path');
var diskspace = require('diskspace');
var gui = require('nw.gui');

var cwd  = process.cwd();

var ddApp = angular.module('ddApp', [
    'ui.router',
    'ddCtrl',
	'720kb.tooltips',
	'angular-progress-arc'
]);


ddApp.config(['$stateProvider','$urlRouterProvider','ngDialogProvider',function ($stateProvider, $urlRouterProvider,ngDialogProvider) {
    //---------------------------------------------------------------
    ngDialogProvider.setDefaults({
//		className: 'ngdialog-theme-default',
        plain: false,
        showClose: false,
        closeByDocument: true,
        closeByEscape: true
    });
    //---------------------------------------------------------------

    $urlRouterProvider.otherwise('/');

    $stateProvider.state('home', {
            url: '/',
            views: {
                'content': {
                    controller: 'HomeCtrl',
                    templateUrl: 'ng/views/home.html'
                }
            },
            onEnter: function () {
console.log("HOME")
	            $("._720kb-tooltip").remove()
            },
		    onExit: function(){
			    $("._720kb-tooltip").remove()
		    }
        })
        .state('settings', {
            url: '/settings',
            views: {
                'content': {
                    controller: 'SettingsCtrl',
                    templateUrl: 'ng/views/settings.html'
                }
            },
            onEnter: function () {
console.log("settings")
	            $("._720kb-tooltip").remove()
            },
		    onExit: function(){
			    $("._720kb-tooltip").remove()
		    }
        })

}]);


ddApp.run(['$rootScope','$timeout','$state','$stateParams',function($rootScope, $timeout, $state, $stateParams){
    $rootScope.$state = $state;
    $rootScope.$stateParams = $stateParams;

	var winobj = gui.Window.get();
	winobj.on('close', function() {
		var message_text = "";
		var self = this;
		sweetAlert({
			title: "Are you sure?",
			text: message_text,
			type: "warning",
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "CLOSE",
			closeOnConfirm: true
		}, function(){
			//TODO: broadcast close, then close the window. needs to kill ffmpeg tasks, etc.

			$rootScope.$broadcast("close_program");
			setTimeout(function(){
				winobj.close(true);
			},100);

			//		$rootScope.$broadcast("close_program");
			//		$timeout(function(){
			//			self.close(true);
			//		},200)

			//angular.module('ddCtrl').
		});
	});


}]);


var ddCtrl = angular.module('ddCtrl', ['ngDialog']);

gui.Window.get().showDevTools()
