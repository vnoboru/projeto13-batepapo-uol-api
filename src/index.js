import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";

const app = express();

dotenv.config();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient
  .connect()
  .then(() => {
    db = mongoClient.db("participantsDb");
  })
  .catch((err) => console.log(err));

//Recebimento dos participantes
app.post("/participants", async (req, res) => {
  const { name } = req.body;
  //Fazendo validação do name com joi
  const schema = joi.object({
    name: joi.string().min(1).max(30).required(),
  });
  //Verificando validação do nome
  const validation = schema.validate(req.body);
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

    //Inserindo um objeto no MongoDB
    await db
      .collection("participants")
      .insertOne({ name, lastStatus: Date.now() });
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

//Retornar lista de todos participantes MongoDB
app.get("/participants", (req, res) => {
  db.collection("participants")
    .find()
    .toArray()
    .then((participants) => {
      res.send(participants);
    })
    .catch((err) => {
      console.log(err);
      res.sendStatus(500);
    });
});

app.listen(5000, () => console.log(`App running in port: 5000`));
