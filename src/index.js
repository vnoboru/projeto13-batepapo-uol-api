import express from "express";
import cors from "cors";
import { ListCollectionsCursor, MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";

const app = express();

dotenv.config();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("participantsDb");
} catch (err) {
  console.log(err);
}

//Recebimento dos participantes
app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const participant = {
    name,
    lastStatus: Date.now(),
  };
  //Fazendo validação do name com joi
  const schema = joi.object({
    name: joi.string().min(1).max(30).required(),
  });
  //Verificando validação do nome
  const validation = schema.validate(participant);
  if (validation.error) {
    console.log("Erro de validação", validation.error);
    res.status(422).send(validation.error.details[0].message);
    return;
  }
  //Verificação para comparar nomes já existentes
  try {
    const participantExists = await db
      .collection("participants")
      .findOne({ name: name });

    if (participantExists) {
      return res.sendStatus(409);
    }

    //Inserindo um objeto de mensagem MongoDB
    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entrar na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    //Inserindo um objeto de usuário no MongoDB
    await db.collection("participants").insertOne(participant);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

//Retornar lista de todos participantes MongoDB
app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

//Recebimento das mensagens
app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const user = req.headers.user;
  //Formato da mensagem
  const message = {
    from: user,
    to,
    text,
    type,
    time: dayjs().format("HH:mm:ss"),
  };
  //Fazendo validação com joi
  const schema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().min(1).required(),
    type: joi.string().required(),
    time: joi.string().required(),
  });
  //Verificando validação
  const validation = schema.validate(message);
  const validateType = type === "message" || type === "private_message";
  //Validação de mensagem
  if (validation.error || !validateType) {
    console.log("Erro de validação", validation.error);
    res.status(422).send("Erro de validação");
    return;
  }

  try {
    const check = await db.collection("participants").findOne({ name: user });
    //Validação de participante
    if (!check) {
      res.status(422).send("Participante não cadastrado");
      return;
    }
    //Inserindo um objeto de mensagem no MongoDB
    await db.collection("messages").insertOne(message);
    console.log(message);
    res.sendStatus(201);
  } catch {
    res.status(422).send("Erro ao enviar mensagem");
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const { user } = req.headers;
  let online = [];
  const printMessages = await db.collection("messages").find().toArray();
  //Buscando as mensagens do usuário que está fazendo a requisição
  online = printMessages.filter(
    (d) => d.from === user || d.to === user || d.to === "Todos"
  );
  if (online) {
    try {
      //Caso tenha limite
      if (limit) {
        const message = online.slice(-limit);
        res.send(message);
        //Casso não tenha limite
      } else {
        const message = online.slice(-100);
        res.send(message);
      }
    } catch (err) {
      res.send(err);
    }
  }
});

app.listen(5000, () => console.log(`App running in port: 5000`));
