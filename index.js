const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Pool = require("pg").Pool;
const app = express();
require("dotenv").config();
const SECRET_KEY = process.env.SECRET_KEY;
const url = process.env.URL_DATABASE;
const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 8081;
function generateToken(key) {
  return btoa(`${key}${SECRET_KEY}`);
}

app.get("/api/:id", async function (req, res) {
  let pageNumber = req.query.page;
  if (pageNumber === undefined) {
    pageNumber = 1;
  }
  let data;
  const id = req.params.id;
  if (id == "home") {
    data = await pool.query(
      `SELECT document_id, title,  content, count(*) OVER() AS full_count FROM documents ORDER BY document_id DESC LIMIT 10 OFFSET ${
        (pageNumber - 1) * 10
      };`
    );
  } else {
    data =
      await pool.query(`SELECT documents.document_id, documents.title, documents.content, count(*) OVER() AS full_count FROM documents, documents_tag WHERE documents.document_id = documents_tag.document_id AND documents_tag.tag_id = ${id} ORDER BY document_id DESC LIMIT 10
                                       OFFSET ${(pageNumber - 1) * 10};`);
  }
  return res.send(data.rows);
});
app.get("/tag", async function (req, res) {
  const data = await pool.query("SELECT tag_id, tag_name FROM tag");
  return res.send(data.rows);
});
app.post("/api", async function (req, res) {
  const tags = req.body.tags;
  const count = tags.length;
  console.log(tags);
  let tagIdQuery = "(";
  tags.forEach((tag) => {
    tagIdQuery += `${tag.tag_id},`;
  });
  tagIdQuery = tagIdQuery.substring(0, tagIdQuery.length - 1);
  tagIdQuery += ")";
  const SELECTS = `select documents.document_id, documents.title, documents.content
  from documents, documents_tag
  where documents_tag.tag_id in ${tagIdQuery}
  and documents.document_id = documents_tag.document_id
  group by documents.document_id
  having count(documents_tag.tag_id) = ${count}
  ORDER BY document_id`;
  console.log(SELECTS);
  const data = await pool.query(SELECTS);
  return res.send(data.rows);
});
app.post("/add/document", async function (req, res) {
  const data = req.body;
  if (
    data.key === generateToken(new Date().getMinutes()) ||
    data.key === generateToken(new Date().getMinutes()) - 1
  ) {
    try {
      let sql = `INSERT INTO documents (title, content) VALUES ('${data.forWhat}', '${data.document}') RETURNING document_id;`;
      const documentId = await pool.query(sql);
      const documentIdValue = documentId.rows[0].document_id;
      const tags = data.selectedTags;
      tags.forEach((tag) => {
        sql = `INSERT INTO documents_tag (document_id, tag_id) VALUES (${documentIdValue}, ${tag.tag_id})`;
        pool.query(sql);
      });
      return res.status(200).send({ isSuccess: true });
    } catch (err) {
      return res.status(500).send({ isSuccess: false, err });
    }
  } else {
    return res.status(403).send({ isSuccess: false });
  }
});
app.post("/add/tag", async function (req, res) {
  const data = req.body;

  if (
    data.key === generateToken(new Date().getMinutes()) ||
    data.key === generateToken(new Date().getMinutes()) - 1
  ) {
    try {
      let sql = `INSERT INTO tag (tag_name) VALUES ('${data.tag}') RETURNING tag_id;`;
      const tagId = await pool.query(sql);
      const tagIdValue = tagId.rows[0].tag_id;
      return res.status(200).send({ isSuccess: true, tagIdValue });
    } catch (err) {
      return res.status(500).send({ isSuccess: false, err });
    }
  } else {
    return res.status(403).send({ isSuccess: false });
  }
});
app.post("/update/document", async function (req, res) {
  const data = req.body;
  const sql = `UPDATE documents SET used_count = used_count + 1 WHERE document_id = ${data.documentId}`;
  try {
    await pool.query(sql);
    return res.status(200).send({ isSuccess: true });
  } catch (err) {
    return res.status(500).send({ isSuccess: false, err });
  }
});
//, count(*) OVER() AS full_count
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
