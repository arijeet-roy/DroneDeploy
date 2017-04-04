'use strict';

var $ = document.querySelector.bind(document);
var generateButton = $('#generate_pdf_view');
var generateButtonText = $('#generate_text');

dronedeploy.onload(onLoad);

//add a click event to the button on load
function onLoad() {
  generateButton.addEventListener('click', generateReportListener);
};

//send annotations along with plan data to be sent to create a pdf
function generateReportListener() {
  dronedeploy.onload(function(){ dronedeploy.Track.successCondition()});
  generateButtonText.innerHTML = 'Generating Map..';

  dronedeploy.Plans.getCurrentlyViewed().subscribe(function (plan) {
    dronedeploy.Tiles.get({ planId: plan.id, layerName: 'ortho', zoom: 18 }).subscribe(function (tileInfo) {
      dronedeploy.Annotations.get(plan.id).subscribe(function (annotations) {
        return createAndSendAnnotationsWithData(plan, tileInfo, annotations);
      }, function (error) {
        return console.error(error);
      });
    });
  });
};

//send data to url using POST with the planId
function sendData(planId, body) {
  return fetch('https://pdf-annotate.herokuapp.com/' + planId, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
};

//hamdle the data sent by opening a new browser tab with the POST url
function handleDataSent(planId) {
  var reportUrl = 'https://pdf-annotate.herokuapp.com/' + planId;
  generateButton.removeEventListener('click', generateReportListener);
  generateButtonText.innerHTML = 'View Map';
  generateButton.onclick = function() {
  	dronedeploy.getExperimentalApi(function(exAPI) {
    	exAPI.Link.open(reportUrl);
  	});
  }
  dronedeploy.getExperimentalApi(function(exAPI) {
    	exAPI.Link.open(reportUrl);
  });
};

function createAndSendAnnotationsWithData(plan, tileInfo, annotations) {
  var volumeAnnotations = annotations.filter(function (annotation) {
    return annotation.annotationType === 'VOLUME';
  });
  var annotationsWithData = [];
  var annotationDataTasks = annotations.map(function (annotation) {
    if (annotation.annotationType !== 'VOLUME') {
      annotationsWithData.push({ annotation: annotation });
      return Promise.resolve();
    }
    return new Promise(makeVolumePromise(annotation, annotationsWithData));
  });


	function makeVolumePromise(annotation, accumulator) {
	  return function (resolve, reject) {
	    dronedeploy.Annotations.getVolume(annotation.id).subscribe(function (volume) {
	      accumulator.push({ annotation: annotation, volume: volume });
	      resolve(volume);
	    }, function (error) {
	      return reject(error);
	    });
	  };
	};

//Promise which handles the asynchronous processing
  Promise.all(annotationDataTasks).then(function () {
    var body = {
      plan: plan,
      tiles: tileInfo,
      annotations: annotationsWithData
    };
    sendData(plan.id, body).then(function () {
      return handleDataSent(plan.id);
    }).catch(function () {
      return handleDataSent(plan.id);
    });
  }).catch(function (error) {
    return console.error(error);
  });
};

