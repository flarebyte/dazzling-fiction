var http = require('http');
var fs = require('fs-extra');
var PORT = 8124;
var S = require('string');


http.createServer(function(request, response) {
    var url = S(request.url);
    var isTxt = url.endsWith('.txt');
    var isJson = url.endsWith('.json');
    var contentType = isJson?'application/json':'text/plain';
    var filename = 'fixtures/web-'+url.chompLeft('/').s;
    var reply200 = function(err, data) {
        if (err) {
            throw err;
        }
        response.writeHead(200, {
            'Content-Type': contentType
        });
        response.end(data);
    };

    if (isTxt || isJson) {
    	fs.readFile(filename, 'utf8', reply200);
    } else {
    	reply200(null,'Not managed by test server');
    }
    
}).listen(PORT);