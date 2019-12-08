express = require("express");
app = express();
http = require("http");
server = require("http").createServer(app);
io = require("socket.io").listen(server);
mysql = require('mysql');
fs = require("fs");
path = require('path');
request = require('request');
crypto = require('crypto');
admin = require("firebase-admin");
Entities = require('html-entities').XmlEntities;

serviceAccount = require("./push-notification-ff5b1-firebase-adminsdk-a43ae-06fd936c46.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://push-notification-ff5b1.firebaseio.com"
});

var database = admin.database();

app.set('port', process.env.PORT || 3000); //<--- replace with your port number

server.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

module.exports = app;

con = mysql.createConnection({
  host: "db4free.net",
  port: 3306,
  user: "tranvanduong2",
  password: "123456789",
  database: "dut_notification"
});

con.connect(function (err) {
  if (err) throw err;

  const sql = "SELECT * FROM THONG_BAO";
  con.query(sql, function (err, rows) {
    list_thong_bao_hien_tai = rows;
    console.log("list_thong_bao_hien_tai.length = " + list_thong_bao_hien_tai.length);
  });

  console.log("MySQL ready!");
});



const URL = 'http://sv.dut.udn.vn';
const URL_ThongBaoChung = "http://sv.dut.udn.vn/G_Thongbao.aspx";
const URL_ThongBaoThayCo = "http://sv.dut.udn.vn/G_Thongbao_LopHP.aspx";

const URL_LichTuan = "http://dut.udn.vn/Lichtuan21";

const entities = new Entities();
var list_thong_bao_hien_tai = [];

function md5(String) {
  return crypto.createHash('md5').update(String).digest("hex");
}

function getPostData($html, $MaSinhVien, $MatKhau) {

  let result1 = $html.match(/_TSM_CombinedScripts_=(.*?)"/);
  let result2 = $html.match(/MainContent_TabContainer1_ClientState" value="(.*?)"/);
  let result3 = $html.match(/__EVENTTARGET" value="(.*?)"/);
  let result4 = $html.match(/__EVENTARGUMENT" value="(.*?)"/);
  let result5 = $html.match(/__VIEWSTATE" value="(.*?)"/);
  let result6 = $html.match(/__VIEWSTATEGENERATOR" value="(.*?)"/);
  let result7 = $html.match(/__EVENTVALIDATION" value="(.*?)"/);

  result1 = result1 === null ? "" : result1[1];
  result2 = result2 === null ? "" : encodeURIComponent(entities.decode(result2[1]));
  result3 = result3 === null ? "" : encodeURIComponent(result3[1]);
  result4 = result4 === null ? "" : encodeURIComponent(result4[1]);
  result5 = result5 === null ? "" : encodeURIComponent(result5[1]);
  result6 = result6 === null ? "" : encodeURIComponent(result6[1]);
  result7 = result7 === null ? "" : encodeURIComponent(result7[1]);

  const $post_data = `MainContent_ToolkitScriptManager1_HiddenField=${result1}&MainContent_TabContainer1_ClientState=${result2}&__EVENTTARGET=${result3}&__EVENTARGUMENT=${result4}&__VIEWSTATE=${result5}&__VIEWSTATEGENERATOR=${result6}&__EVENTVALIDATION=${result7}&ctl00%24TextBox1=${$MaSinhVien}&ctl00%24TextBox2=${$MatKhau}&ctl00%24BT_DNhap=%C4%90%C4%83ng+nh%E1%BA%ADp`;
  return $post_data;
}

function set_list_hocphan($html, ListHocPhan) {
  const reg = `<td align="center" valign="middle"><font face="Arial" color="#333333" size="3">.{0,50}<\/font><\/td><td align="left"><font face="Arial" color="#333333" size="3">[^~]{0,50}<span id="[^~]{0,50}">(.*?)<\/span>[^~]{0,50}<\/font><\/td><td align="left" valign="middle" nowrap="nowrap"><font face="Arial" color="#333333" size="3">(.*?)<\/font><\/td><td align="center"><font face="Arial" color="#333333" size="3">[^~]{0,50}<span id="[^~]{0,50}">(.*?)<\/span>[^~]{0,50}<\/font><\/td><td align="right"><font face="Arial" color="#333333" size="3">[^~]{0,50}<span id="[^~]{0,50}">.{0,50}<\/span>[^~]{0,50}<\/font><\/td><td align="center" nowrap="nowrap"><font face="Arial" color="#333333" size="3">[^~]{0,50}<\/font><\/td><td align="left" valign="middle" nowrap="nowrap"><font face="Arial" color="#333333" size="3">(.*?)<\/font><\/td><td align="left" nowrap="nowrap"><font face="Arial" color="#333333" size="3">(.*?)<\/font><\/td><td align="center" valign="middle" nowrap="nowrap"><font face="Arial" color="#333333" size="3">(.*?)<\/font>`;
  const regex1 = RegExp(reg, 'g');
  let array;

  while ((array = regex1.exec($html)) !== null) {
    let HocPhan = {};
    HocPhan.MaHocPhan = array[1].replace(/[\.]/g, '-');
    HocPhan.TenHocPhan = entities.decode(array[2]);
    let res = HocPhan.MaHocPhan.split("-");
    HocPhan.TenLopHocPhan = `[${res[res.length - 2]}.Nh${res[res.length - 1]}] ${HocPhan.TenHocPhan}`;
    HocPhan.TinChi = array[3];
    HocPhan.GiangVien = entities.decode(array[4]);
    HocPhan.LichHoc = array[5];
    HocPhan.TuanHoc = array[6];
    ListHocPhan.push(HocPhan);
  }
}

function get_list_thong_bao($html, $Loai) {
  const regex = RegExp(/ormal">([^~]*?)(?=<p class="MsoN|<!DOCTYPE )/, 'g');

  let array;
  let list_thong_bao = [];

  while ((array = regex.exec($html)) !== null) {
    array[0] = '<p class="MsoN' + array[0];

    let TieuDe = array[0].match(/<p class="MsoNormal">(.*?)<\/span><o:p \/>/);
    if (TieuDe === null) continue;

    let thong_bao = {};
    thong_bao.TieuDe = entities.decode(TieuDe[0]);
    thong_bao.NoiDung = entities.decode(array[0].substring(TieuDe[0].length));
    thong_bao.Loai = $Loai;
    thong_bao.DaXem = false;
    thong_bao.ID = md5(thong_bao.TieuDe + thong_bao.NoiDung);
    list_thong_bao.push(thong_bao);
  }

  return list_thong_bao;
}

function getListTuanHoc($html) {
  const regex1 = RegExp(/>Tuần thứ (.*?)<\/option>/, 'g');
  let array;

  let ListTuanHoc =[];
  while ((array = regex1.exec($html)) !== null) {
    let TuanHoc = {};
    let ans = array[1].split(": ");
    TuanHoc.Tuan = ans[0];
    TuanHoc.ThoiGian = ans[1];
    ListTuanHoc.push(TuanHoc);
  }
  return ListTuanHoc;
}

function setSinhVien1(html, SV) {
  let MaSinhVien = html.match(/<input name=".{0,50}TBemail" type="text" value="(.*?)@/);
  let Ten = html.match(/<input name=".{0,50}TBhoten" type="text" value="(.*?)"/);
  let Khoa = html.match(/<input name=".{0,50}TBnganh" type="text" value="(.*?)"/);
  let Lop = html.match(/<input name=".{0,50}TBlop" type="text" value="(.*?)"/);
  let Email = html.match(/<input name=".{0,50}TBemail2" type="text" value="(.*?)"/);

  if (SV === null || MaSinhVien === null || Ten === null || Khoa === null || Lop === null || Email === null) return false;


  SV.MaSinhVien = MaSinhVien[1];
  SV.Ten = Ten[1];
  SV.Khoa = Khoa[1];
  SV.Lop = Lop[1];
  SV.Email = Email[1];
  return true;
}

function setSinhVien2(html, SV) {

  const reg = `<tr bgcolor=".{0,50}">[^~]{0,50}<td align="center" valign="middle" nowrap="nowrap"><font face="Arial" color="#333333" size="3">[0-9\\\/\-]{0,11}<\/font><\/td><td align="right"><font face="Arial" color="#333333" size="3">[0-9\.]{0,5}<\/font><\/td><td align="right"><font face="Arial" color="#333333" size="3">.{0,50}<\/font><\/td><td align="right" nowrap="nowrap"><font face="Arial" color="#333333" size="3">(.*?)<\/font><\/td><td align="center" valign="middle"><font face="Arial" color="#333333" size="3">[0-9\.]{0,4}<\/font><\/td><td align="center"><font face="Arial" color="#333333" size="3">[0-9\.]{0,10}<\/font><\/td><td align="center" nowrap="nowrap"><font face="Arial" color="#333333" size="3">(.*?)<\/font><\/td><td align="center"><font face="Arial" color="#333333" size="3">[0-9\.]{0,5}<\/font><\/td><td align="center" valign="middle" nowrap="nowrap"><font face="Arial" color="#333333" size="3">.{0,50}<\/font><\/td><td align="center"><font face="Arial" color="#333333" size="3">[0-9]{1,2}<\/font><\/td><td align="center"><font face="Arial" color="#333333" size="3">.{0,50}<\/font><\/td><td align="center"><font face="Arial" color="#333333" size="3">[0-9]{0,3}<\/font><\/td><td align="center"><font face="Arial" color="#333333" size="3">[0-9]{0,3}<\/font><\/td>`;
  const regex1 = RegExp(reg, 'g');

  let tmp, array;
  while ((tmp = regex1.exec(html)) !== null) {
    array = tmp;
    console.log(tmp[1], tmp[2]);
  }

  if (Array.isArray(array) && array.length === 3 && SV !== null) {
    SV.TC = array[1];
    SV.T4 = array[2];
    return true;
  }
  return false;
}

function SaveLoginToDB(SV, $ListHocPhan, $Token) {
  let sql = "INSERT IGNORE INTO SINH_VIEN (MaSinhVien, Ten, Khoa, Lop, Email,TC,T4) VALUES ?";
  let values = [[SV.MaSinhVien, SV.Ten, SV.Khoa, SV.Lop, SV.Email, SV.TC, SV.T4]];

  con.query(sql, [values], function (err) {
    if (err) throw err;
    //con.end();
  });

  let sql1 = "INSERT IGNORE INTO HOC_PHAN (MaHocPhan, TenHocPhan, TenLopHocPhan, TinChi, GiangVien, LichHoc,TuanHoc) VALUES ?";
  let sql2 = "INSERT IGNORE INTO DK_HOC_PHAN (MaSinhVien, MaHocPhan) VALUES ?";

  let values1 = [];
  let values2 = [];
  for (let i = 0; i < $ListHocPhan.length; i++) {
    let HP = $ListHocPhan[i];
    values1.push([HP.MaHocPhan, HP.TenLopHocPhan, HP.TenLopHocPhan, HP.TinChi, HP.GiangVien, HP.LichHoc, HP.TuanHoc]);
    values2.push([SV.MaSinhVien, HP.MaHocPhan]);
  }

  con.query(sql1, [values1], function (err) {
    if (err) throw err;

    con.query(sql2, [values2], function (err) {
      if (err) throw err;
      //con.end();
    });

  });

  sql = "INSERT IGNORE INTO LS_THIETBI (MaSinhVien, Token) VALUES ?";
  values = [[SV.MaSinhVien, $Token]];

  con.query(sql, [values], function (err) {
    if (err) throw err;
    // con.end();
  });
}

function SaveThongBao(list_thong_bao) {
  const sql = "INSERT INTO THONG_BAO (TieuDe, NoiDung, Loai, DaXem) VALUES ?";
  let values = [];

  for (let i = 0; i < list_thong_bao.length; i++) {
    let thongbao = list_thong_bao[i];
    values.push([thongbao.TieuDe, thongbao.NoiDung, thongbao.Loai, thongbao.DaXem]);
  }

  con.query(sql, [values], function (err) {
    if (err) throw err;
    console.log("Đã lưu thông báo thành công!");
  });
}

function sendToFireBaseCouldMessagesing(ThongBao, registrationTokens, callback) {
  if (registrationTokens.length === 0) {
    callback();
    return;
  }

  var payload = {
    data: {
      ID: ThongBao.ID + "",
      TieuDe: ThongBao.TieuDe,
      NoiDung: ThongBao.NoiDung,
      Loai: ThongBao.Loai,
      DaXem: ThongBao.DaXem.toString()
    }
  };

  admin.messaging().sendToDevice(registrationTokens, payload)
      .then(function (response) {
        console.log('Successfully sent message:', response);
        callback();
      })
      .catch(function (error) {
        console.log('Error sending message:', error);
      });

  return true;
}

function TonTai(ThongBao) {
  for (let i = 0; i < list_thong_bao_hien_tai.length; i++) {
    let tb = list_thong_bao_hien_tai[i];

    if (tb.TieuDe !== ThongBao.TieuDe) continue;
    if (tb.NoiDung !== ThongBao.NoiDung) continue;
    if (tb.Loai !== ThongBao.Loai) continue;

    return true;
  }
  return false;
}

function writeThongBao(ThongBao, MaSinhVien) {
  database.ref(MaSinhVien + "/" + ThongBao.Loai + "/" + ThongBao.ID).set({
    ID: ThongBao.ID,
    TieuDe: ThongBao.TieuDe,
    NoiDung: ThongBao.NoiDung,
    Loai: ThongBao.Loai,
    DaXem: ThongBao.DaXem
  });

  if (ThongBao.Loai === "ThongBaoChung") {
    database.ref("ThongBaoChungToanBo/" + ThongBao.ID).set({
      ID: ThongBao.ID,
      TieuDe: ThongBao.TieuDe,
      NoiDung: ThongBao.NoiDung,
      Loai: ThongBao.Loai,
      DaXem: ThongBao.DaXem
    });
  }
}

function writeTuanHocToFireBase(ListTuanHoc) {
  for (let i = 0; i < ListTuanHoc.length; i++) {
    let TuanHoc = ListTuanHoc[i];
    database.ref("TuanHoc/" + TuanHoc.Tuan).set({
          Tuan: TuanHoc.Tuan,
          ThoiGian: TuanHoc.ThoiGian
        }
    );
  }
}

function writeToFireBase(ListHocPhan, MaSinhVien) {
  for (let i=0; i<ListHocPhan.length;i++) {
    let HP = ListHocPhan[i];
    database.ref(MaSinhVien + "/" + "HocPhan/" + HP.MaHocPhan).set({
          MaHocPhan: HP.MaHocPhan,
          TenHocPhan: HP.TenHocPhan,
          TenLopHocPhan: HP.TenLopHocPhan,
          TinChi: HP.TinChi,
          GiangVien: HP.GiangVien,
          LichHoc: HP.LichHoc,
          TuanHoc: HP.TuanHoc
        }
    );
  }


  database.ref(MaSinhVien + "/ThongBaoChung/").once('value', (snap) => {
    if (snap.val() === null) {
      database.ref("ThongBaoChungToanBo").once('value', (snap) => {
        database.ref(MaSinhVien + "/" + "ThongBaoChung").set(snap.val());
      });
    }
  });
}

function getListToken(rows) {
  let registrationTokens = [];
  for (let i = 0; i < rows.length; i++)
    registrationTokens.push(rows[i].Token);
  return registrationTokens;
}


io.sockets.on('connection', function (socket) {
  socket.on('user-request-login', function (MaSinhVien, MatKhau, Token) {
    console.log(MaSinhVien, "********", Token);

    let KQHT = 0, NhanThan = 0, DSHocPhan = 0, SV = {}, ListHocPhan = [];
    const callback_login = function () {
      console.log(`Trạng thái xử lý đăng nhập: KQHT=${KQHT}, NhanThan=${NhanThan} , DSHocPhan=${DSHocPhan} `);
      if (KQHT === 1 && NhanThan === 1 && DSHocPhan === 1) {
        if (SV != null && ListHocPhan.length !== 0) {
          socket.emit('server-sent-login-reponse', JSON.stringify(SV));
          console.log(MaSinhVien + ": đăng nhập thành công");

          SaveLoginToDB(SV, ListHocPhan, Token);
          writeToFireBase(ListHocPhan, MaSinhVien);
        } else {
          socket.emit('server-sent-login-reponse', "Lỗi");
          console.log(MaSinhVien + ": Đăng nhập lỗi");
        }
      }

    };
    request.get(URL, function (err, res, body) {
      const post_data = getPostData(body, MaSinhVien, MatKhau);
      if (!Array.isArray(res.headers['set-cookie'])) {
        let err = "Không truy cập được sv.dut.udn.vn để lấy dữ liệu!";
        socket.emit('server-sent-login-reponse', err);
        console.log(MaSinhVien + ": " + err);
        return;
      }
      const cookie = res.headers['set-cookie'][0];

      request.post(URL, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookie
        },
        body: post_data,
        followAllRedirects: true
      }, function (error, response, body) {
        request.get("http://sv.dut.udn.vn/S_KQHoctap.aspx", {headers: {'Cookie': cookie}}, function (err, res, body) {
          let status = setSinhVien2(body, SV);
          if (status === false) SV = null;

          KQHT = 1;
          callback_login();
        });

        request.get("http://sv.dut.udn.vn/S_NhanThan.aspx", {headers: {'Cookie': cookie}}, function (err, res, body) {
          let status = setSinhVien1(body, SV);
          if (status === false) SV = null;

          NhanThan = 1;
          callback_login();
        });

        request.get("http://sv.dut.udn.vn/S_LichHoc.aspx", {headers: {'Cookie': cookie}}, function (err, res, body) {
          set_list_hocphan(body, ListHocPhan);

          DSHocPhan = 1;
          callback_login();
        });

      });
    });
  });

  socket.on('user-request-logout', function (MaSinhVien, Token) {
    const sql = `DELETE FROM LS_THIETBI WHERE MaSinhVien ='${MaSinhVien}' AND Token = '${Token}'`;
    con.query(sql, function (err, rows, result) {
      if (!err && rows.affectedRows !== 0) {
        socket.emit('server-sent-logout-status', 1);
      } else {
        let sql = `SELECT * FROM LS_THIETBI WHERE MaSinhVien ='${MaSinhVien}' AND Token = '${Token}'`;
        con.query(sql, function (err, rows) {
          if (rows.length === 0) {
            socket.emit('server-sent-logout-status', 1);
            return;
          }
          socket.emit('server-sent-logout-status', 0);
        });
      }
    });
  });
});

app.get("/get-thong-bao-tu-sv-du-udn-vn", function (req, res) {
  console.log("list_thong_bao_hien_tai.length = " + list_thong_bao_hien_tai.length);
  console.log("Đang lấy dữ liệu từ phía: " + URL);
  res.send("request received");


  request.get(URL_ThongBaoChung, function (err, res, body) {
    let ListThongBaoTuDUT = get_list_thong_bao(body, "ThongBaoChung");
    if (ListThongBaoTuDUT.length === 0) {
      console.log(`${URL_ThongBaoChung}: Lỗi`);
      return;
    }

    let CoThongBaoChung = false;

    for (let i = 0; i < ListThongBaoTuDUT.length; i++) {
      let ThongBao = ListThongBaoTuDUT[i];
      if (TonTai(ThongBao) === false) {
        CoThongBaoChung = true;

        const sql = 'SELECT Token FROM LS_THIETBI';
        con.query(sql, function (err, rows) {
          if (err) throw err;
          let registrationTokens = getListToken(rows);

          sendToFireBaseCouldMessagesing(ThongBao, registrationTokens, function () {
            SaveThongBao([ThongBao]);
            list_thong_bao_hien_tai.push(ThongBao);
            const sql = 'SELECT MaSinhVien FROM SINH_VIEN';
            con.query(sql, function (err, rows) {
              for (let i = 0; i < rows.length; i++)
                writeThongBao(ThongBao, rows[i].MaSinhVien);
            });
          });
        });
      }
    }

    if (CoThongBaoChung === false) {
      console.log("Không có thông báo chung mới!");
      return;
    }
  });

  request.get(URL_ThongBaoThayCo, function (err, res, body) {
    let ListThongBaoTuDUT = get_list_thong_bao(body, "ThayCo");
    if (ListThongBaoTuDUT.length === 0) {
      console.log(`${URL_ThongBaoThayCo}: Lỗi`);
      return;
    }

    let CoThongBaoThayCo = false;

    for (let i = 0; i < ListThongBaoTuDUT.length; i++) {
      let ThongBao = ListThongBaoTuDUT[i];
      if (TonTai(ThongBao) === false) {
        CoThongBaoThayCo = true;

        const sql = `
                        SELECT MaSinhVien,Token FROM LS_THIETBI
                        WHERE MaSinhVien IN (SELECT MaSinhVien FROM SINH_VIEN
                        WHERE MaSinhVien IN (SELECT MaSinhVien FROM DK_HOC_PHAN
                        WHERE MaHocPhan IN (SELECT MaHocPhan
                        FROM HOC_PHAN WHERE POSITION(HOC_PHAN.TenLopHocPhan IN '${ThongBao.TieuDe}') > 0)))`;

        con.query(sql, function (err, rows) {
          if (err) throw err;

          let registrationTokens = [];
          for (let i = 0; i < rows.length; i++) {
            registrationTokens.push(rows[i].Token);
            writeThongBao(ThongBao, rows[i].MaSinhVien);
          }

          sendToFireBaseCouldMessagesing(ThongBao, registrationTokens, function () {
            SaveThongBao([ThongBao]);
            list_thong_bao_hien_tai.push(ThongBao);
          });
        });
      }
    }

    if (CoThongBaoThayCo === false) {
      console.log("Không có thông báo thầy cô mới!");
      return;
    }

  });


  request.get(URL_LichTuan, function (err, res, body) {

    let ListTuanHoc = getListTuanHoc(body);

    if (ListTuanHoc.length === 0) {
      console.log(`Get list tuan hoc: Lỗi`);
      return;
    }


    writeTuanHocToFireBase(ListTuanHoc);
  });
});