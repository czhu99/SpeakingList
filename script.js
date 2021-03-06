var http = require('http');
var path = require('path');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var Rooms = [];
var usernames = []; //{}for json data, but we use [] because of the way we store the data
var UniqueCode = true;
var ValidCode = false;
var genCode;
var NumberOfGuests = 0;

var usernameToSocket = {};

io.on('connection', function(socket) {
    //socket.emit vs io.sockets.emit
    //socket.emit returns to the person who called it.
    //io.sockets.emit returns to everyone connected except for the person who called it.

    socket.on("Create Session", function(Data) { //Creates a room and stores Host Data
        genRand(); //Generates a random session code
        var Name = Data.hostName; //Stores the host's name
        socket.username = Name; //Stores the host name locally to the host.
        socket.room = genCode;
        NumberOfGuests++; //Increases the number of people using the site
        usernames.push({
            userName: Name,
            code: genCode,
            rank: "Host",
            List: [],
            sessionState: false
        }); //Pushes the Host information into an array of everyone
        Rooms.push(genCode); //Makes a new room with the name of the session code
        socket.join(genCode); //Have the host join the room
        socket.emit('recieve code', {
            Code: genCode //Sends the host back the code
        });
        usernameToSocket[Name] = socket;
    });
    //Whenever a client joins an existing session
    socket.on("join session", function(Code) { //Implement a if/else that prevents people from joining if the session is already in session
        ValidCode = false;
        var GivenName = Code.dataName;
        var GivenCode = Code.dataCode;
        var GroupList = [];
        for (i = 0; i < NumberOfGuests; i++) {
            if (usernames[i]['code'] == GivenCode && usernames[i]['rank'] == "Host") {
                if (usernames[i]['sessionState'] == true) //Prevents you from joining ingame sessions
                {
                    ValidCode = false;
                } else {
                    NumberOfGuests++;
                    for (i = 0; i < Rooms.length; i++) {
                        if (GivenCode == Rooms[i]) {
                            ValidCode = true;
                            socket.room = Rooms[i];
                            socket.username = GivenName;
                            usernames.push({
                                userName: GivenName,
                                code: GivenCode,
                                rank: "User",
                                NSA: "Not on list"
                            });
                            socket.join(Rooms[i]);
                            for (j = 0; j < NumberOfGuests; j++) {
                                if (usernames[j]['code'] == GivenCode) //This might be unessacary
                                {
                                    if (usernames[j]['rank'] != "Host") //Finds the apporpriate room to push you into
                                    {
                                        GroupList.push(usernames[j]['userName']);
                                    }
                                }
                            }
                            socket.emit('user recieve code', {
                                Code: GivenCode
                            }); //returns back to the caller
                            io.sockets.emit('displayName', {
                                Code: GivenCode,
                                List: GroupList
                            }); //returns to everyone

                        }
                    }
                } //
            }
        }
        if (ValidCode == false) {
            socket.emit('Bad Code', {
                result: false
            });
        }
        usernameToSocket[GivenName] = socket;
    });

    socket.on("Start Session", function(Data) {
        var GivenCode = Data.code;
        io.sockets.emit('start session', {
            Code: GivenCode
        });
        for (x = 0; x < NumberOfGuests; x++) {
            if (usernames[x]['rank'] == "Host") {
                if (usernames[x]['code'] == GivenCode) {
                    usernames[x]['sessionState'] = true;
                }
            }
        }
    });

    socket.on("Add name to list", function(Data) {
        var userName = Data.userName;
        var userCode = Data.userCode;
        var List = [];
        for (i = 0; i < Rooms.length; i++) {
            if (userCode == Rooms[i]) {
                for (j = 0; j < NumberOfGuests; j++) {
                    if (usernames[j]['userName'] == userName) {
                        usernames[j]['NSA'] = "On a list";
                    }
                }
            }
        }


        for (x = 0; x < NumberOfGuests; x++) {
            if (usernames[x]['rank'] == "Host") {
                if (usernames[x]['code'] == userCode) {
                    List = usernames[x]['List'];
                    List.push(userName);
                    usernames[x]['List'] = List;
                }
            }
        }
        

        socket.emit('Added Name', {
            Code: Data.userCode
        });
        io.sockets.emit('Add Name', {
            Code: userCode,
            List: List
        });
    });

    socket.on("Take name off list", function(Data) {
        var userName = Data.userName;
        var userCode = Data.userCode;
        console.log(userCode);
        var List = [];

        for (i = 0; i < Rooms.length; i++) {
            if (userCode == Rooms[i]) {
                for (j = 0; j < NumberOfGuests; j++) {
                    if (usernames[j]['userName'] == userName) {
                        usernames[j]['NSA'] = "Not on list";
                    }
                }
            }
        }

        for (x = 0; x < NumberOfGuests; x++) {
            if (usernames[x]['rank'] === "Host") {
                if (usernames[x]['code'] == userCode) {
                    List = usernames[x]['List'];
                    List.splice(List.indexOf(userName), 1);
                    usernames[x]['List'] = List;
                }
            }
        }

        socket.emit('TookNameOff', {
            Code: Data.code
        });

        io.sockets.emit('Add Name', {
            Code: userCode,
            List: List
        });
        
        usernameToSocket[userName].emit("TookNameOff", {}) // for the client
    });

    socket.on("End Session", function(Data) { //Host calls it to end people in groups sessions
        io.sockets.emit('end of session', {
            Code: Data.code
        });
    });

    socket.on('disconnect', function(data) {
        //console.log("Below is the person that disconnected")
        //console.log(socket.username)
        for (i = 0; i < usernames.length; i++) {
            if (usernames[i]['userName'] == socket.username) {
                if (usernames[i]['rank'] == 'User') {
                    NumberOfGuests--;
                } else if (usernames[i]['rank'] == 'Host') {
                    for (j = 0; j < Rooms.length; j++) {
                        if (Rooms[j] == usernames[i]['code']) {
                            io.sockets.emit('end of session', {
                                Code: usernames[i]['code']
                            })
                            Rooms.splice(j, 1);
                            NumberOfGuests--;
                        }
                    }
                }
                usernames.splice(i, 1);
            }
        }
        socket.leave(socket.room);
    });
});

function genRand() {
    genCode = Math.floor(Math.random() * 100000);
    var HostNumber = 0;
    for (i = 0; i < usernames.length; i++) {
        if (usernames[i]['rank'] == 'Host') {
            HostNumber++;
        }
    }

    for (i = 0; i < HostNumber; i++) {
        if (usernames[i]['rank'] == 'Host') {
            if (usernames[i]['code'] == genCode) {
                UniqueCode = false;
                break;
            }
        }
    }
    if (UniqueCode == false) {
        UniqueCode = true;
        genRand();
    }
}

function send404Response(response) {
    response.writeHead(404, {
        "Content-Type": "text/plain"
    });
    response.write("Error 404: Page not found!");
    response.end();
};

app.use(express.static(__dirname + '/public'));

server.listen(process.env.PORT || 3000, function() {
    console.log('Server listening at port 3000');
});