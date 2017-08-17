'use strict';

var _ = require('lodash');
var moment = require('moment');
var levels = require('../levels');

function init(ctx) {
  var translate = ctx.language.translate;

  var lage = {
    name: 'lage'
    , label: 'Long Acting Insulin Age'
    , pluginType: 'pill-minor'
  };

  lage.getPrefs = function getPrefs(sbx) {
    // LAGE_INFO=44 LAGE_WARN=48 LAGE_URGENT=70
    return {
      info: sbx.extendedSettings.info || 22
      , warn: sbx.extendedSettings.warn || 24
      , urgent: sbx.extendedSettings.urgent || 25
      , enableAlerts: sbx.extendedSettings.enableAlerts || false
    };
  };

  lage.setProperties = function setProperties (sbx) {
    sbx.offerProperty('lage', function setProp ( ) {
      return lage.findLatestTimeChange(sbx);
    });
  };

  lage.checkNotifications = function checkNotifications(sbx) {
    var doseInfo = sbx.properties.lage;

    if (doseInfo.notification) {
      var notification = _.extend({}, doseInfo.notification, {
        plugin: lage
        , debug: {
          age: doseInfo.age
        }
      });

      sbx.notifications.requestNotify(notification);
    }
  };

  lage.findLatestTimeChange = function findLatestTimeChange(sbx) {

    var doseInfo = {
      found: false
      , age: 0
      , treatmentDate: null
      //
      //, treatmentDose: 0
    };

    var prevDate = 0;
    //
    //var treatmentDose = 0

    _.each(sbx.data.longActingTreatments, function eachTreatment (treatment) {
      var treatmentDate = treatment.mills;
      //
      //var treatmentDose = treatment.insulin;
      if (treatmentDate > prevDate && treatmentDate <= sbx.time) {

        prevDate = treatmentDate;
        doseInfo.treatmentDate = treatmentDate;
        
        //
        //doseInfo.treatmentDose = treatmentDose;

        var a = moment(sbx.time);
        var b = moment(doseInfo.treatmentDate);
        var days = a.diff(b,'days');
        var hours = a.diff(b,'hours') - days * 24;
        var age = a.diff(b,'hours');

        if (!doseInfo.found || (age >= 0 && age < doseInfo.age)) {
          doseInfo.found = true;
          doseInfo.age = age;
          doseInfo.days = days;
          doseInfo.hours = hours;
          doseInfo.notes = treatment.notes;
          doseInfo.minFractions = a.diff(b,'minutes') - age * 60;
          //
          doseInfo.dose = treatment.insulin;

          doseInfo.display = '';
          if (doseInfo.age >= 24) {
            doseInfo.display += doseInfo.days + 'd';
          }
          doseInfo.display += doseInfo.hours + 'h';
        }
      }
    });

    var prefs = lage.getPrefs(sbx);

    doseInfo.level = levels.NONE;

    var sound = 'incoming';
    var message;
    var sendNotification = false;

    if (doseInfo.age >= doseInfo.urgent) {
      sendNotification = doseInfo.age === prefs.urgent;
      message = translate('Long acting insulin dose overdue!');
      sound = 'persistent';
      doseInfo.level = levels.URGENT;
    } else if (doseInfo.age >= prefs.warn) {
      sendNotification = doseInfo.age === prefs.warn;
      message = translate('Time for long acting insulin dose');
      doseInfo.level = levels.WARN;
    } else  if (doseInfo.age >= prefs.info) {
      sendNotification = doseInfo.age === prefs.info;
      message = translate('Give long acting insulin dose soon');
      doseInfo.level = levels.INFO;
    }

    //allow for 20 minute period after a full hour during which we'll alert the user
    if (prefs.enableAlerts && sendNotification && doseInfo.minFractions <= 20) {
      doseInfo.notification = {
        title: translate('Long acting insulin dose %1 hours ago', { params: [doseInfo.age] })
        , message: message
        , pushoverSound: sound
        , level: doseInfo.level
        , group: 'LAGE'
      };
    }

    return doseInfo;
  };

  lage.updateVisualisation = function updateVisualisation (sbx) {

    var doseInfo = sbx.properties.lage;

    var info = [{ label: translate('Long Acting'), value: new Date(doseInfo.treatmentDate).toLocaleString() }];
    //   if (!_.isEmpty(doseInfo.dose)) {
    //      info.push({label: translate('Dose:'), value: doseInfo.dose});
    if (!_.isEmpty(doseInfo.notes)) {
      info.push({label: translate('Notes:'), value: doseInfo.notes});
    }

    var statusClass = null;
    if (doseInfo.level === levels.URGENT) {
      statusClass = 'urgent';
    } else if (doseInfo.level === levels.WARN) {
      statusClass = 'warn';
    }
    sbx.pluginBase.updatePillText(lage, {
      value: doseInfo.display
      , label: translate('LAGE')
      , info: info
      , pillClass: statusClass
    });
  };

  return lage;
}

module.exports = init;

