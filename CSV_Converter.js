const config = require("./config.json");
const fs = require("fs");
const papa = require("papaparse");
const axios = require("axios");
const axiosInstance = axios.create({
  baseURL: config.baseURL,
  headers: {'Authorization': config.token}
});

let file = fs.createReadStream("./" + config.fileToProcess);

//Processes the result that is returned by converting the CSV file into single objects.
//Searches for Events were the bed exit alert is activatet and converts them into Event objects for a SensorLink instance
//Uploads the conveted event objects to a patient with the defined id in the config.json file
let processData = function (results) {
  let data = results.data;
  //Sortes the data by the timestamps
  data.sort(function(a, b) {
    let dateA = new Date(a.Time)
    let dateB = new Date(b.Time);
    if (dateA > dateB) return 1;
    else if (dateA < dateB) return -1;
    return 0;
  });
  //Is used to save the created event objects
  let events = [];
  let eventCounter = 0;

  //BedExitAlert information is analyzed and if a BedExitAlert is triggered a event will be created
  //As soon as the BedExitAlert is set to 0 again the end time of the event will be set and the next event can be created
  for (let i = 1; i < data.length; i++) {
    let e1 = data[i-1];
    let e2 = data[i];
    //Compares two objects and analyses the state of the BedExitAlert
    if(e1.BedExitAlertSituation==0 && e2.BedExitAlertSituation!=0){
      events[eventCounter] = {} 
      events[eventCounter].from = convertDateString(e2.Time);
    } else if (e1.BedExitAlertSituation!=0 && e2.BedExitAlertSituation==0) {
      events[eventCounter].to = convertDateString(e2.Time);
      eventCounter++;
    }
  }

//Sents POST requests for each found BedExit event to a SensorLink instance
//The patient id as well as the URL of the SensorLink instance have to be defined in the config.json file
events.forEach(event => {
  event.eventName = "Bett Verlassen";
  axiosInstance.post(config.baseURL + "/patients/" + config.patid + "/events", event).then(res => {
    console.log(res.data);
  }).catch(err => console.log(err.response.data));
});

}

//Parser for the CSV file
papa.parse(file, {
    header: true,
    delimiter: ";",
    //Removes the first two rows
    beforeFirstChunk: function(chunk) {
        var rows = chunk.split( /\r\n|\r|\n/ );
        rows.shift();
        rows.shift();
        rows[0] = rows[0].replace(/\s/g, '');
        return rows.join("\r\n");
    },
    error: (err) => console.log(err),
    complete: (results) => processData(results)
  })
  
let convertDateString = (string) => {
  p = string.split(/[\s:.]+/);
  return new Date(p[2]+"-"+p[1]+"-"+p[0]+"T"+p[3]+":"+p[4]+":"+p[5])
}
