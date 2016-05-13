define([
  'angular',
  'app/core/table_model',
  'lodash',
  './directives',
  './query_ctrl',
],
function (angular, TableModel, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('BosunDatasource', function($q, backendSrv, templateSrv) {

    function BosunDatasource(datasource) {
      this.type = 'bosun';
      this.editorSrc = 'app/features/bosun/partials/query.editor.html';
      this.name = datasource.name;
      this.supportMetrics = true;
      this.url = datasource.url;
      this.lastErrors = {};
    }

    BosunDatasource.prototype._request = function(method, url, data) {
      var options = {
        url: this.url + url,
        method: method,
        data: data,
      };

      return backendSrv.datasourceRequest(options);
    };

    // Called once per panel (graph)
    BosunDatasource.prototype.query = function(options) {
      var queries = [];
      // Get time values to replace $start
      // The end time is what bosun regards as 'now'
      var secondsAgo = options.range.to.diff(options.range.from.utc(), 'seconds');
      secondsAgo += 's';
      _.each(options.targets, _.bind(function(target) {
        if (!target.expr || target.hide) {
          return;
        }
        var query = {};
        query = templateSrv.replace(target.expr, options.scopedVars);
        query = query.replace('$start', secondsAgo);
        query = query.replace('$ds', options.interval);
        queries.push(query);
      }, this));

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var allQueryPromise = _.map(queries, _.bind(function(query, index) {
        return this.performTimeSeriesQuery(query, options.targets[index], options);
      }, this));

      return $q.all(allQueryPromise)
        .then(function(allResponse) {
          var result = [];
          _.each(allResponse, function(response) {
            _.each(response.data, function(d) {
              result.push(d);
            });
          });
          return { data: result };
        });
    };

    BosunDatasource.prototype.performTimeSeriesQuery = function(query, target, options) {
      var exprDate = options.range.to.utc().format('YYYY-MM-DD');
      var exprTime = options.range.to.utc().format('HH:mm:ss');
      var url = '/api/expr?date=' + encodeURIComponent(exprDate) + '&time=' + encodeURIComponent(exprTime);
      return this._request('POST', url, query).then(function(response) {
        var result;
        if (response.data.Type === 'series') {
          result = _.map(response.data.Results, function(result) {
            return transformMetricData(result, target, options);
          });
        }
        if (response.data.Type === 'number') {
          result = makeTable(response.data.Results);
        }
        return { data: result };
      });
    };

    BosunDatasource.prototype._performSuggestQuery = function(query) {
      return this._get('/api/metrics', {type: 'metrics', q: query, max: 1000}).then(function(result) {
        return result.data;
      });
    };

    BosunDatasource.prototype._performMetricKeyLookup = function(metric) {
      if(!metric) { return $q.when([]); }

      return this._get('/api/tagk/' + metric).then(function(result) {
        return result.data;
      });
    };

    BosunDatasource.prototype._performMetricKeyValueLookup = function(metric, key, since) {
      if(!metric || !key) {
        return $q.when([]);
      }

      return this._get('/api/tagv/' + key + "/" + metric + "?since=" + since).then(function(result) {
        return result.data;
      });
    };

    BosunDatasource.prototype._performMetricKeyValueWithSubtagsLookup = function(metric, key, subtags, since) {
      if(!metric || !key || !subtags) {
        return $q.when([]);
      }

      var subtags_list = subtags.split(",").map(function(s) { return s.trim() });
      var valid_subtags = subtags_list.filter(function (s) {
        return s.split("=")[1] !== "*"
          && s.split("=")[1].charAt(0) !== "$"
          && s.split("=")[1] !== "";
      });
      valid_subtags.push("since="+since)
      var params = "?" + valid_subtags.join("&");

      return this._get('/api/tagv/' + key + "/" + metric + params).then(function(result) {
        return result.data;
      });
    };

    BosunDatasource.prototype.metricFindQuery = function(query) {
      if (!query) { return $q.when([]); }

      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      var responseTransform = function(result) {
        return _.map(result, function(value) {
          return {text: value};
        });
      };

      var metrics_regex = /^metrics\((.*)\)/;
      var tag_names_regex = /^tag_names\((.*)\)/;
      var tag_values_regex = /^tag_values\((.*),\s?([^)]+)\)/;
      var tag_values_with_subtags_regex = /^tag_values_with_subtags\(([^,]+),\s?([^,]+),\s?([^)]+)\)/;

      var since = "1d"
      var since_regex = /\)\.since\((.*)\)$/;

      var since_query = interpolated.match(since_regex);
      if (since_query) {
        since = since_query[1]
      }

      var metrics_query = interpolated.match(metrics_regex);
      if (metrics_query) {
        return this._performSuggestQuery(metrics_query[1]).then(responseTransform);
      }

      var tag_names_query = interpolated.match(tag_names_regex);
      if (tag_names_query) {
        return this._performMetricKeyLookup(tag_names_query[1]).then(responseTransform);
      }

      var tag_values_query = interpolated.match(tag_values_regex);
      if (tag_values_query) {
        return this._performMetricKeyValueLookup(tag_values_query[1], tag_values_query[2], since).then(responseTransform);
      }

      var tag_values_with_subtags_query = interpolated.match(tag_values_with_subtags_regex);
      if (tag_values_with_subtags_query) {
        return this._performMetricKeyValueWithSubtagsLookup(tag_values_with_subtags_query[1],
                                                            tag_values_with_subtags_query[2],
                                                            tag_values_with_subtags_query[3],
                                                            since).then(responseTransform);
      }

      return $q.when([]);
    };

    BosunDatasource.prototype._get = function(relativeUrl, params) {
      return backendSrv.datasourceRequest({
        method: 'GET',
        url: this.url + relativeUrl,
        params: params,
      });
    };

    function makeTable(result) {
      var table = new TableModel();
      if (Object.keys(result).length < 1) {
        return table;
      }
      var tagKeys = [];
      _.each(result[0].Group, function(v, tagKey) {
        tagKeys.push(tagKey);
      });
      tagKeys.sort();
      table.columns = _.map(tagKeys, function(tagKey) {
        return {"text": tagKey};
      });
      table.columns.push({"text": "value"});
      _.each(result, function(res) {
         var row = [];
         _.each(res.Group, function(tagValue, tagKey) {
           row[tagKeys.indexOf(tagKey)] = tagValue;
         });
         row.push(res.Value);
         table.rows.push(row);
      });
      return [table];
    }

    function transformMetricData(result, target, options) {
      var tagData = [];
      _.each(result.Group, function(v, k) {
        tagData.push({'value': v, 'key': k});
      });
      var sortedTags = _.sortBy(tagData, 'key');
      var metricLabel = "";
      if (target.alias) {
        var scopedVars = _.clone(options.scopedVars || {});
        _.each(sortedTags, function(value) {
          scopedVars['tag_' + value.key] = {"value": value.value};
        });
        metricLabel = templateSrv.replace(target.alias, scopedVars);
      } else {
        tagData = [];
        _.each(sortedTags, function(tag) {
          tagData.push(tag.key + '=' + tag.value);
        });
        metricLabel = '{' + tagData.join(', ') + '}';
      }
      var dps = [];
      _.each(result.Value, function (v, k) {
        dps.push([v, parseInt(k) * 1000]);
      });
      return { target: metricLabel, datapoints: dps };
    }

    return BosunDatasource;
  });

});
