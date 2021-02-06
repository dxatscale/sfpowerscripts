const xmlParser = require("xml2js").Parser({ explicitArray: false });

export default function xml2json(xml) {
  return new Promise((resolve, reject) => {
    xmlParser.parseString(xml, function (err, json) {
      if (err) reject(err);
      else resolve(json);
    });
  });
}
