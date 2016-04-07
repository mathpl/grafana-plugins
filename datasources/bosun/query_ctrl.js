///<reference path="../../../headers/common.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var sdk_1 = require('app/plugins/sdk');
var BosunQueryCtrl = (function (_super) {
    __extends(BosunQueryCtrl, _super);
    /** @ngInject **/
    function BosunQueryCtrl($scope, $injector) {
        _super.call(this, $scope, $injector);
        var target = this.target;
        target.expr = target.expr || '';
    }
    BosunQueryCtrl.prototype.targetBlur = function () {
        this.refresh();
    };
    BosunQueryCtrl.templateUrl = 'partials/query.editor.html';
    return BosunQueryCtrl;
}(sdk_1.QueryCtrl));
exports.BosunQueryCtrl = BosunQueryCtrl;
