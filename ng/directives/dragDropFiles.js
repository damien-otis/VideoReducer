angular.module("ddCtrl").directive("dragDropFiles",[
	'$rootScope',
	function($rootScope){
	return {
		restrict:"A",
		link:function($scope,$el,attrs){
			// prevent default behavior from changing page on dropped file
			function onDragOver(e) {
				$el.addClass('filedrop');
				e.preventDefault();
				$rootScope.$broadcast("dragDropFiles_over");
				return false
			}

			function onDragLeave(e) {
				$el.removeClass('filedrop');
				e.preventDefault();
				return false
			}

			function onDrop($evt) {
				$el.removeClass('filedrop');
				var e = $evt.originalEvent;
				e.preventDefault();
				$evt.stopPropagation()

				if (!e.dataTransfer){return}

				var droppedFiles = e.dataTransfer.files;

				$rootScope.$emit("dragDropFiles_drop",droppedFiles);

				return false;
			}

			function bindUnbind(bind){
				var action = bind ? "bind":"unbind";
				$(window)[action]("dragover", onDragOver);
				$(window)[action]("dragleave", onDragLeave);
				$(window)[action]("drop", onDrop);
//				$el[action]("dragover", onDragOver);
//				$el[action]("mouseleave", onDragLeave);
//				$el[action]("drop", onDrop);
			}

			bindUnbind(true);

		}
	}
}]);