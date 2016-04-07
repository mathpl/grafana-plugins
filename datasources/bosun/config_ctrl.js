///<reference path="../../../headers/common.d.ts" />
"use strict";
var BosunConfigCtrl = (function () {
    /** @ngInject */
    function BosunConfigCtrl($scope) {
        this.current.jsonData = this.current.jsonData || {};
    }
    BosunConfigCtrl.templateUrl = 'public/app/plugins/datasource/bosun/partials/config.html';
    return BosunConfigCtrl;
}());
exports.BosunConfigCtrl = BosunConfigCtrl;
