const { PrismaClient } = require('@prisma/client');

const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
//const { Server } = require("socket.io");
const fs = require("fs");
const fileUpload = require("express-fileupload");

const prisma = new PrismaClient();
const app = express();
const server = createServer(app);

app.use(fileUpload());
app.use(express.static("userStuff"));
app.use(express.static(__dirname + "/upload"));

// ... you will write your Prisma Client queries here
async function main(data) {

    await prisma.user_account.create(data);
    const allUsers = await prisma.user_account.findMany();
    console.log(allUsers);
}

// Server stuff
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "userStuff/index.html"));
});

app.post("/all.html", (req, res) => {
    var userData = fs.readFileSync("userData.json");
    var myObj = JSON.parse(userData);
    res.sendFile(join(__dirname, "userStuff/all.html"));
});

app.post("/edit.html", (req, res) => {
    var userData = fs.readFileSync("userData.json");
    var myObj = JSON.parse(userData);

    res.sendFile(join(__dirname, "userStuff/edit.html"));
});

app.post("/create.html", (req, res) => {
    var userData = fs.readFileSync("userData.json");
    var myObj = JSON.parse(userData);
    let alreadyExists = false;
    myObj.Users.map((user) => {
        if (req.body.email == user.email) {
            alreadyExists = true;
            console.log("\nUsername taken!");
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
                image: req.files.image.name
            }
        }
        main(usr)
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
        req.files.image.mv(__dirname + "/upload/" + req.files.image.name);
        myObj.Users.push(req.body);
        var newData2 = JSON.stringify(myObj, null, 2);
        fs.writeFile("userData.json", newData2, (err) => {
          if (err) throw err;
          console.log("New data added");
        });    
        res.sendFile(join(__dirname, "userStuff/create.html"));
    }
});

server.listen(3000, () => {
    console.log("Server is listening at port 3000");
});

