// Defines everything that is required for it to work
const { PrismaClient } = require('@prisma/client');
const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const fs = require("fs");
const fileUpload = require("express-fileupload");

// Creates a server and a socket.io connection
const prisma = new PrismaClient();
const app = express();
const server = createServer(app);
const io = new Server(server);

// Forces it to use fileupload and changes all files path from inside userStuff and upload to the main to not have to send every file though express
app.use(fileUpload());
app.use(express.static("userStuff"));
app.use(express.static(__dirname + "/upload"));

// Prisma client functions for everything. Takes in what to run and the data to use as well
async function main(what, data) {
    if (what == "Create") {
        await prisma.user_account.create(data);
    }
    else if (what == "Edit") {
        await prisma.user_account.update({
            where: {
                email: data.email,
            },
            data: {
                name: data.name,
                phone: data.phone,
                image: data.image,
            },
        });
    } else if (what == "All") {
        const allUsers = await prisma.user_account.findMany();
        io.emit("show", allUsers);
    } else if (what == "Delete") {
        await prisma.user_account.delete({
            where: {
                email: data,
            }
        })
    } else {
        console.log("No query selected!");
    }
}

// Server stuff

// Socket.io Stuff
io.on("connection", (socket) => {
    // When reciving "chose" from the client, fetch a users data through checking the json file for a user with matching email. If none found send false to client
    socket.on("chose", (who) => {
        let i = false;
        var userData = fs.readFileSync("./userData.json");

        var myObj = JSON.parse(userData);
        myObj.Users.map((user) => {
            if (user.email == who) {
                io.emit("chosen", user);
                i = true;
            }
        });
        if (!i) {
            io.emit("chosen", false);
        }
    });
    // When reciving "showAll" run the function "main" with the parameter "All" to fetch all users and send to the client for printing
    socket.on("showAll", () => {
        main("All", "");
    });
    // When reciving "deleteThis" check such that an email has been inputted, if it has search json file for user that has it and then remove it. 
    // Also runs the "main" function with "Delete" parameter together with the inputted email to delete it from the db
    socket.on("deleteThis", (email) => {
        if (email) {
            let arr = { Users: [] };
            var userData = fs.readFileSync("userData.json");
            var myObj = JSON.parse(userData);
            myObj.Users.map((user) => {
                if (user.email !== email) {
                    arr.Users.push(user);
                }
            });
            fs.writeFile("./userData.json", JSON.stringify(arr, null, 2), (err) => {
                if (err) throw err;
            });
            main("Delete", email);
        }
    })
})

// Post requests
// On a post request in the edit.html path change the user in both the db and the json file with the inputted data
app.post("/edit.html", (req, res) => {
    let arr = { Users: [] };
    var userData = fs.readFileSync("userData.json");
    var myObj = JSON.parse(userData);
    myObj.Users.map((user) => {
        if (user.email === req.body.email) {
            user["name"] = req.body.name;
            user["email"] = req.body.email;
            user["phone"] = req.body.phone;
            if(req.body.image == undefined){
                user["image"] = req.files.image.name;
                req.files.image.mv(__dirname + "/upload/" + req.files.image.name);
            }else{
                user["image"] = req.body.image;
            }
            main("Edit", user)
                .then(async () => {
                    await prisma.$disconnect();
                })
                .catch(async (e) => {
                    console.error(e);
                    if (e.code === "P2002") {
                        console.log("User email already exists!");
                    }
                    await prisma.$disconnect();
                    process.exit(1);
                })
        }
        arr.Users.push(user);
    });
    fs.writeFile("./userData.json", JSON.stringify(arr, null, 2), (err) => {
        if (err) throw err;
    });
    res.sendFile(join(__dirname, "userStuff/edit.html"));
});

// On a post request in the create.html path create a user in both the json file and db
app.post("/create.html", (req, res) => {
    var userData = fs.readFileSync("userData.json");
    var myObj = JSON.parse(userData);
    let alreadyExists = false;
    myObj.Users.map((user) => {
        if (req.body.email == user.email) {
            alreadyExists = true;
            console.log("\nUsername taken!\n");
            res.sendFile(join(__dirname, "userStuff/index.html"));
        }
    });
    if (!alreadyExists) {
        let usr = {
            data:
            {
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
            }
        }
        if (req.body.image == undefined) {
            usr.data.image = req.files.image.name;
        } else {
            usr.data.image = req.body.image;
        }

        main("Create", usr)
            .then(async () => {
                await prisma.$disconnect();
            })
            .catch(async (e) => {
                console.error(e);
                if (e.code === "P2002") {
                    console.log("User email already exists!");
                }
                await prisma.$disconnect();
                process.exit(1);
            })
        if (req.body.image == undefined) {
            req.files.image.mv(__dirname + "/upload/" + req.files.image.name);
        }

        myObj.Users.push(usr.data);
        var newData2 = JSON.stringify(myObj, null, 2);
        fs.writeFile("userData.json", newData2, (err) => {
            if (err) throw err;
        });
        res.sendFile(join(__dirname, "userStuff/create.html"));
    }
});

// Starts the server at port
server.listen(3000, () => {
    console.log("Server is listening at port 3000");
});

