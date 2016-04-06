///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';

export class BosunQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    var target = this.target;
    target.expr = target.expr || '';
  }

  targetBlur() {
    this.refresh();
  }
}
