const { PrismaClient } = require('@prisma/client');

const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const fs = require("fs");
const fileUpload = require("express-fileupload");

const prisma = new PrismaClient();
const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(fileUpload());
app.use(express.static("userStuff"));
app.use(express.static(__dirname + "/upload"));

// ... you will write your Prisma Client queries here
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
    /* const allUsers = await prisma.user_account.findMany();
    console.log(allUsers); */
}

// Server stuff
// Socket.io Stuff
io.on("connection", (socket) => {
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
    socket.on("showAll", () => {
        main("All", "");
    });
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
app.post("/edit.html", (req, res) => {
    let arr = { Users: [] };
    var userData = fs.readFileSync("userData.json");
    var myObj = JSON.parse(userData);
    myObj.Users.map((user) => {
        if (user.email === req.body.email) {
            user["name"] = req.body.name;
            user["email"] = req.body.email;
            user["phone"] = req.body.phone;
            user["image"] = req.files.image.name;
            req.files.image.mv(__dirname + "/upload/" + req.files.image.name);
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
                image: req.files.image.name
            }
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
        req.files.image.mv(__dirname + "/upload/" + req.files.image.name);
        myObj.Users.push(req.body);
        var newData2 = JSON.stringify(myObj, null, 2);
        fs.writeFile("userData.json", newData2, (err) => {
            if (err) throw err;
        });
        res.sendFile(join(__dirname, "userStuff/create.html"));
    }
});

server.listen(3000, () => {
    console.log("Server is listening at port 3000");
});

