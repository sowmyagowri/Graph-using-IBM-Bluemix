var express = require('express');
var cfenv = require('cfenv');
var app = express();
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var request = require('request-promise'); /* Note: using promise-friendly lib */
var uuid = require('node-uuid');
var appEnv = cfenv.getAppEnv();
var util = require('util');

app.set('port', process.env.PORT);
app.use(express.static(__dirname + '/public'));

//start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function (){
    // print a message when the server starts listening
    console.log('server starting on ' + appEnv.url);
});

var apiURL; var username; var password; var baseURL;
apiURL = '<api URL>';
username = '<username>';
password = '<password>';
baseURL = apiURL.split('/g').join('');

var sessionToken;
var getTokenOpts = {
    method: 'GET',
    uri: baseURL + '/_session',
    auth: {user: username, pass: password},
    json: true
};

request(getTokenOpts).then(function (body) {
	sessionToken = 'gds-token ' + body['gds-token'];
	createGraph();
});

function createGraph(){
	var graphCreateOpts = {
			method: 'POST',
			headers: {'Authorization': sessionToken},
			uri: baseURL + '/_graphs',
			json: true
    	};
		request(graphCreateOpts).then(function (body) {
			apiURL = body.dbUrl; //Update apiURL to use new graph
			createSchema();
		});
}

function createSchema(){
	fs.readFileAsync('./Schema Request.json', 'utf-8').then(function (data) {
		//Now send the request to IBM Graph
		var postSchemaOpts = {
				method: 'POST',
				headers: {'Authorization': sessionToken},
				uri: apiURL + '/schema',
				json: JSON.parse(data.toString())
		};
		return request(postSchemaOpts);
	}).then(function (body) {
		fs.writeFile('./Schema Response.json', JSON.stringify(body), function(error) {
        	if (error) throw error;
        	console.log('Successfully created schema and the response has been saved to the output JSON file. ');
        	createVertices();
		});
	});
}

function createVertices(){
	var vertex1, vertex2, vertex3;
	var body = {
			'label': 'Employee',
			'properties': {
				'employee_name': 'Sowmya',
				'id': 12345,
				'manager' : 'Rakesh Ranjan'
			}
	};
	var postVertexOpts = {
	    method: 'POST',
	    headers: {'Authorization': sessionToken},
	    uri: apiURL + '/vertices',
	    json: body
	};
	request(postVertexOpts).then(function (body) {
		vertex1 = body.result.data[0].id;
		var body = {
			'label': 'Department',
			'properties': {
				'department_name': 'Engineering',
				'manager' : 'Rakesh Ranjan',
				'strength' : 100
			}
		};
		var postVertexOpts = {
			method: 'POST',
			headers: {'Authorization': sessionToken},
			uri: apiURL + '/vertices',
			json: body
		};
		request(postVertexOpts).then(function (body) {
			vertex2 = body.result.data[0].id;
		
			var body = {
				'label': 'Project',
				'properties': {
					'project_manager' : 'Rakesh Ranjan',
					'project_name' : 'IBM Cloud'
				}
			};
			var postVertexOpts = {
				method: 'POST',
				headers: {'Authorization': sessionToken},
				uri: apiURL + '/vertices',
				json: body
			};
			return request(postVertexOpts);
			}).then(function (body) {
				vertex3 = body.result.data[0].id;
				createEdges(vertex1, vertex2, vertex3);
			});
		});
}

function createEdges(vertex1, vertex2, vertex3){
	var edge1, edge2, edge3;
	var body = {
			'inV' : vertex3,
			'outV' : vertex1,
			'label': 'works_on'
	};
	var postEdgeOpts = {
	    method: 'POST',
	    headers: {'Authorization': sessionToken},
	    uri: apiURL + '/edges',
	    json: body
	};
	request(postEdgeOpts).then(function (body) {
		edge1 = body.result.data[0].id;
	
		var body = {
			'label': 'has',
			'inV' : vertex3,
			'outV' : vertex2
		};
		var postEdgeOpts = {
			    method: 'POST',
			    headers: {'Authorization': sessionToken},
			    uri: apiURL + '/edges',
			    json: body
		};
		request(postEdgeOpts).then(function (body) {
			edge2 = body.result.data[0].id;
		
			var body = {
				'label': 'works_in',
				'inV' : vertex2,
				'outV' : vertex1
			};
			var postEdgeOpts = {
				method: 'POST',
				headers: {'Authorization': sessionToken},
				uri: apiURL + '/edges',
				json: body
			};
			return request(postEdgeOpts);
			}).then(function (body) {
				edge3 = body.result.data[0].id;
				runGremlin(vertex1,vertex2,vertex3);
		});
	});
}

function runGremlin(vertex1, vertex2, vertex3){
	// Finally, run a gremlin traversal.
    // We would like to return (find) all the vertices connected by
    // an incoming edge from our employee vertex
	var body = {
		'gremlin': 'graph.traversal().V().has("employee_name" , "Sowmya").outE("works_on").inV().has("project_name" , "IBM Cloud").inE("has").outV().inE("works_in").outV().path();'
	};
	var gremlinQueryOpts = {
		method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: apiURL + '/gremlin',
        json: body
	};
    return request(gremlinQueryOpts).then(function (body) {
    	for (var i = 0; i < body.result.data.length; i++) {
    		fs.writeFile('./Graph Response.json', JSON.stringify(body), function(error) {
            	if (error) throw error;
            	console.log('successfully found the vertex.')
    		});
    	};
    });
}
