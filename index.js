import express from "express";
import mysql from "mysql2";
import cors from "cors";
import crypto from "crypto";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";

const connection = mysql.createConnection({
  host: "178.16.137.63",
  user: "satria",
  password: "VPSLt4",
  database: "incit_db",
});

const transporter = nodemailer.createTransport({
  port: 465,
  host: "smtp.gmail.com",
  auth: {
    user: "kararasatria081@gmail.com",
    pass: "zzci akyp eepw vwrx",
  },
  secure: true,
});

const generateRandomString = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < 16; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const queryPromise = (query) => {
  return new Promise((resolve, reject) => {
    connection.query(query, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

connection.connect();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "https://incit-2024.web.app"],
  })
);
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
const port = 1928;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/register", (req, res) => {
  let query = `SELECT * from users where email = "${req.body.email}"`;

  const pw = crypto
    .createHash("sha256")
    .update(req.body.password)
    .digest("hex");
  const email = req.body.email;
  // start query
  connection.query(query, (err, rows, fields) => {
    if (err) throw err;
    if (rows.length > 0) {
      res.status(200).send("Email already registered");
    } else {
      let query2 = `insert into users (email, password,created_at) values ('${email}', '${pw}', DATE_ADD(NOW(), INTERVAL 7 HOUR))`;
      connection.query(query2, (err, rows, fields) => {
        if (err) throw err;
        const code = generateRandomString();
        const link = `http://localhost:1928/verifEmail?code=${code}`;
        const mailData = {
          from: "kararasatria081@gmail.com",
          to: email,
          subject: "Incit - Email verification",
          html: `<b>Click link below to activate your account </b> <br> ${link} <br/>`,
        };

        let updateQuery = `UPDATE users SET verif_code = "${code}" WHERE email = "${email}"`;
        connection.query(updateQuery, (updateErr, updateResult) => {
          if (updateErr) throw updateErr;

          transporter.sendMail(mailData, (error, info) => {
            if (error) {
              res.status(404).send({ message: "mail fail" });
              return console.log(error);
            }
            res.status(200).send("Account Registered, check your email");
          });
        });
      });
    }
  });
});

app.post("/login", async (req, res) => {
  // prepare values
  const email = req.body.email;
  const pw = crypto
    .createHash("sha256")
    .update(req.body.password)
    .digest("hex");
  let query = `SELECT email, first_name, last_name, active from users where email = "${email}" AND password = "${pw}"`;
  // start query
  connection.query(query, async (err, rows, fields) => {
    if (err) throw err;
    if (rows.length > 0) {
      let updateQuery = `UPDATE users SET last_login = DATE_ADD(NOW(), INTERVAL 7 HOUR), total_login = total_login + 1 WHERE email = "${email}" AND password = "${pw}"`;
      const tableDataQuery = `insert into login_log (email, login_date) values ('${email}', DATE_ADD(NOW(), INTERVAL 7 HOUR))`;
      const insertLoginLog = await queryPromise(tableDataQuery);
      connection.query(updateQuery, (updateErr, updateResult) => {
        if (updateErr) throw updateErr;

        res.status(200).send(rows[0]);
      });
    } else {
      res
        .status(401)
        .send("Your login credentials don't match an account in our system");
    }
  });
});

app.post("/updateProfile", (req, res) => {
  // prepare values
  const { email, firstName, lastName } = req.body;
  let updateQuery = `UPDATE users SET first_name = "${firstName}", last_name = "${lastName}" WHERE email = "${email}"`;

  connection.query(updateQuery, (updateErr, updateResult) => {
    if (updateErr) throw updateErr;
    let query = `SELECT email, first_name, last_name from users where email = "${email}"`;
    connection.query(query, (err, rows, fields) => {
      if (err) throw err;
      res.status(200).send({ message: "Update Success", user: rows[0] });
    });
  });
});

app.get("/dashboardData", async (req, res) => {
  const tableDataQuery = `SELECT first_name,last_name, email, total_login, last_login, last_logout, created_at FROM users`;
  const tableDataResult = await queryPromise(tableDataQuery);

  const weekAverageQuery = `SELECT DATE(login_date) AS days, COUNT(DISTINCT email) AS active_user FROM login_log WHERE login_date >= NOW() - INTERVAL 7 DAY GROUP BY DATE(login_date)`;
  const weekAverageResult = await queryPromise(weekAverageQuery);
  let sum = 0;
  for (let i = 0; i < weekAverageResult.length; i++) {
    sum += weekAverageResult[i].active_user;
  }
  sum = sum / 7;

  res
    .status(200)
    .send({ tableData: tableDataResult, averageWeekly: sum.toFixed(2) });
});

app.post("/logout", (req, res) => {
  let updateQuery = `UPDATE users SET last_logout = DATE_ADD(NOW(), INTERVAL 7 HOUR) WHERE email = "${req.body.email}"`;

  connection.query(updateQuery, (updateErr, updateResult) => {
    if (updateErr) throw updateErr;
    res.status(200).send("Logout Success");
  });
});

app.post("/updatePassword", (req, res) => {
  // prepare values
  const { password, newPassword, email } = req.body;
  // check if the old password is correct or no
  const pw = crypto.createHash("sha256").update(password).digest("hex");

  let query = `SELECT email from users where email = "${email}" AND password = "${pw}"`;
  // start query
  connection.query(query, (err, rows, fields) => {
    if (err) throw err;
    if (rows.length > 0) {
      const newpw = crypto
        .createHash("sha256")
        .update(newPassword)
        .digest("hex");
      let updateQuery = `UPDATE users SET password = "${newpw}" WHERE email = "${email}"`;

      connection.query(updateQuery, (updateErr, updateResult) => {
        if (updateErr) throw updateErr;

        res.status(200).send(rows[0]);
      });
    } else {
      res.status(401).send("Old password is incorrect");
    }
  });
});

app.post("/oauth", async (req, res) => {
  const { email, given_name, family_name } = req.body.user;
  // jika email udah ada maka login, else bikin
  let query = `SELECT email, first_name, last_name, active from users where email = "${email}"`;
  connection.query(query, async (err, rows, fields) => {
    if (err) throw err;
    if (rows.length > 0) {
      let updateQuery = `UPDATE users SET last_login = DATE_ADD(NOW(), INTERVAL 7 HOUR), total_login = total_login + 1 WHERE email = "${email}"`;
      const tableDataQuery = `insert into login_log (email, login_date) values ('${email}', DATE_ADD(NOW(), INTERVAL 7 HOUR))`;
      const insertLoginLog = await queryPromise(tableDataQuery);
      connection.query(updateQuery, (updateErr, updateResult) => {
        if (updateErr) throw updateErr;

        res.status(200).send(rows[0]);
      });
    } else {
      let query2 = `insert into users (email, first_name, last_name,created_at, last_login, active) values ('${email}','${given_name}','${family_name}', DATE_ADD(NOW(), INTERVAL 7 HOUR), DATE_ADD(NOW(), INTERVAL 7 HOUR), 1)`;
      const tableDataQuery = `insert into login_log (email, login_date) values ('${email}', DATE_ADD(NOW(), INTERVAL 7 HOUR))`;
      const insertLoginLog = await queryPromise(tableDataQuery);
      connection.query(query2, (err, rows, fields) => {
        if (err) throw err;
        res.status(200).send({
          email: email,
          first_name: given_name,
          last_name: family_name,
          active: 1,
        });
      });
    }
  });
});

app.get("/verifEmail", (req, res) => {
  const { code } = req.query;
  let query = `SELECT * from users where verif_code = "${code}"`;
  connection.query(query, (err, rows, fields) => {
    if (err) throw err;
    if (rows.length > 0) {
      let updateQuery = `UPDATE users SET active = 1 WHERE verif_code = "${code}"`;
      connection.query(updateQuery, (updateErr, updateResult) => {
        if (updateErr) throw updateErr;
        let redirectUrl = "http://localhost:5173/dashboard";
        res.redirect(redirectUrl);
        // res.status(200).send(rows[0]);
      });
    } else {
      res
        .status(401)
        .send("Your link is invalid, try login and resend email verification");
    }
  });
});

app.post("/resendEMail", (req, res) => {
  const { email } = req.body;
  const code = generateRandomString();
  const link = `http://localhost:1928/verifEmail?code=${code}`;
  const mailData = {
    from: "kararasatria081@gmail.com",
    to: email,
    subject: "Incit - Email verification",
    html: `<b>Click link below to activate your account </b> <br> ${link} <br/>`,
  };
  let updateQuery = `UPDATE users SET verif_code = "${code}" WHERE email = "${email}"`;
  connection.query(updateQuery, (updateErr, updateResult) => {
    if (updateErr) throw updateErr;

    transporter.sendMail(mailData, (error, info) => {
      if (error) {
        res.status(404).send({ message: "mail fail" });
        return console.log(error);
      }
      res.status(200).send("Email sent, check your email");
    });
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
