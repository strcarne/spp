// /Users/strcarne/Documents/bsuir/spp/server.js
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Модель данных (в памяти для простоты)
let tasks = [
  {
    id: uuidv4(),
    title: "Изучить Node.js",
    description: "Изучить основы Node.js и Express",
    status: "pending",
    dueDate: "2025-09-25",
    attachments: [],
    createdAt: new Date(),
  },
  {
    id: uuidv4(),
    title: "Создать API",
    description: "Разработать REST API для приложения",
    status: "in_progress",
    dueDate: "2025-09-30",
    attachments: [],
    createdAt: new Date(),
  },
];

// Маршруты

// Главная страница - список задач с фильтрацией
app.get("/", (req, res) => {
  const filter = req.query.filter || "all";
  let filteredTasks = tasks;

  if (filter !== "all") {
    filteredTasks = tasks.filter((task) => task.status === filter);
  }

  res.render("index", {
    tasks: filteredTasks,
    filter: filter,
    statuses: ["all", "pending", "in_progress", "completed"],
  });
});

// Страница создания новой задачи
app.get("/task/new", (req, res) => {
  res.render("new-task");
});

// Создание новой задачи
app.post("/task", upload.array("attachments"), (req, res) => {
  const { title, description, status, dueDate } = req.body;

  const newTask = {
    id: uuidv4(),
    title: title,
    description: description,
    status: status || "pending",
    dueDate: dueDate,
    attachments: req.files.map((file) => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
    })),
    createdAt: new Date(),
  };

  tasks.push(newTask);
  res.redirect("/");
});

// Страница редактирования задачи
app.get("/task/:id/edit", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) {
    return res.status(404).send("Задача не найдена");
  }
  res.render("edit-task", { task });
});

// Обновление задачи
app.post("/task/:id", upload.array("attachments"), (req, res) => {
  const taskIndex = tasks.findIndex((t) => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).send("Задача не найдена");
  }

  const { title, description, status, dueDate } = req.body;

  // Добавляем новые файлы к существующим
  const newAttachments = req.files
    ? req.files.map((file) => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
      }))
    : [];

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    title: title,
    description: description,
    status: status,
    dueDate: dueDate,
    attachments: [...tasks[taskIndex].attachments, ...newAttachments],
  };

  // Перенаправляем обратно к форме редактирования с параметром успеха
  res.redirect(`/task/${req.params.id}/edit?success=true`);
});

// Удаление задачи
app.post("/task/:id/delete", (req, res) => {
  const taskIndex = tasks.findIndex((t) => t.id === req.params.id);
  if (taskIndex !== -1) {
    // Удаляем прикрепленные файлы
    tasks[taskIndex].attachments.forEach((attachment) => {
      if (fs.existsSync(attachment.path)) {
        fs.unlinkSync(attachment.path);
      }
    });
    tasks.splice(taskIndex, 1);
  }
  res.redirect("/");
});

// Скачивание файлов
app.get("/download/:filename", (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(__dirname, "uploads", filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send("Файл не найден");
  }
});

// Удаление прикрепленного файла
app.post("/task/:id/attachment/:filename/delete", (req, res) => {
  const taskId = req.params.id;
  const filename = decodeURIComponent(req.params.filename);

  console.log(`Попытка удаления файла: ${filename} для задачи: ${taskId}`);

  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  if (taskIndex !== -1) {
    const attachmentIndex = tasks[taskIndex].attachments.findIndex(
      (att) => att.filename === filename
    );

    if (attachmentIndex !== -1) {
      const attachment = tasks[taskIndex].attachments[attachmentIndex];
      console.log(`Найден файл для удаления: ${attachment.originalname}`);

      if (fs.existsSync(attachment.path)) {
        fs.unlinkSync(attachment.path);
        console.log(`Файл удален с диска: ${attachment.path}`);
      }
      tasks[taskIndex].attachments.splice(attachmentIndex, 1);
      console.log(`Файл удален из задачи`);
    } else {
      console.log(
        `Файл не найден в задаче. Доступные файлы:`,
        tasks[taskIndex].attachments.map((att) => att.filename)
      );
    }
  } else {
    console.log(`Задача не найдена`);
  }

  res.redirect(`/task/${taskId}/edit`);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Перейдите по адресу http://localhost:${PORT}`);
});
