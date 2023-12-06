const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const User = require("./models/UserModel");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const PostModel = require("./models/Post");

const SECRET_KEY = "secretkey";

const app = express();

const { default: mongoose } = require("mongoose");
mongoose.connect(
  "mongodb+srv://blog:p2000oSxycAQePoz@cluster0.jqgb6sg.mongodb.net/test"
);
let db = mongoose.connection;
db.once("open", function () {
  console.log("DATABASE CONNECTED");
});

app.use(bodyParser.json());
app.use(cors());
app.use('/uploads', express.static(__dirname + '/uploads'))


const authenticateToken = (req, res, next) => {
  const token =
    req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = user;
    next(); 
  });
};


app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error signing up" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ error: "Invalid username" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      SECRET_KEY
    );
    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ error: "Error logging in" });
  }
});


app.post("/post", authenticateToken, upload.single("file"), async (req, res) => {
    try {
      const { originalname, path } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];

      const newPath = path + "." + ext;
      fs.renameSync(path, newPath);

      const { title, content } = req.body;
      const postDoc = await PostModel.create({
        title,
        content,
        cover: newPath,
        author: req.user.userId,
    });
    
    res.json(postDoc);
} catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Error creating post" });
    }
}
);

app.put('/post', authenticateToken, upload.single("file"), async (req, res) => {
    let newPath = null;
    if(req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split(".");
        const ext = parts[parts.length - 1];

        newPath = path + "." + ext;
        fs.renameSync(path, newPath);

        const { id, title, content } = req.body;
        const postDoc = await PostModel.findById(id)

        const user = req.user;

        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(user.userId)
        if(!isAuthor) {
          return res.status(400).json('You are not the author')
        }

        await postDoc.updateOne({ title, content, cover: newPath ? newPath : postDoc.cover })
        res.json(postDoc)
    }   
})

app.get("/post", async (req, res) => {
    res.json(
    await PostModel.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get('/post/:id', async (req, res) => {
    const {id} = req.params;
    const postDoc = await PostModel.findById(id).populate('author', ['username']);

    res.json(postDoc)
})


const port = 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
