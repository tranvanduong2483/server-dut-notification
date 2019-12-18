// Import các mô đun cần thiết
var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io").listen(server);
var fs = require("fs");
var mysql = require('mysql');
var request = require('request');
var Entities = require('html-entities').XmlEntities;

var crypto = require('crypto');
var admin = require("firebase-admin");
///================================================================================================


//Các cấu hình cần thiết để dùng FIREBASE CLOUD MESSAGING và FIREBASE DATABASE REALTIME
var serviceAccount = require("./push-notification-ff5b1-firebase-adminsdk-a43ae-06fd936c46.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://push-notification-ff5b1.firebaseio.com"
});
var database = admin.database();
///================================================================================================


// Cài đặt cổng port mà máy chủ nơi đặt project này hỗ trợ, hoặc 3000 nếu hỗ trợ hết
server.listen(process.env.PORT || 3000);

// Tạo kết nối đến cơ sở dữ liệu MySQL
var con = mysql.createConnection({
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
///========================================================================================


// Khai báo các đường dẫn để lấy server truy cập lấy dữ liệu, và các biến cần thiết để sử dụng
const URL = 'http://sv.dut.udn.vn';
const URL_ThongBaoChung = "http://sv.dut.udn.vn/G_Thongbao.aspx";
const URL_ThongBaoThayCo = "http://sv.dut.udn.vn/G_Thongbao_LopHP.aspx";
const URL_LichTuan = "http://dut.udn.vn/Lichtuan21";

const entities = new Entities();
var list_thong_bao_hien_tai = -1;
//=========================================================================================

/*
    Chức năng: Sử dụng để lấy mã md5 của một chuỗi, mục đích để lưu ID của của thông báo

    Đầu vào: Chuỗi
    Đầu ra: Chuỗi sau khi mã hóa MD5
*/
function md5(String) {
    return crypto.createHash('md5').update(String).digest("hex");
}

/* Chức năng: Tạo biểu mẫu đăng nhập mà server sv.dut.udn.vn yêu cầu để đăng nhập.
    Trước đó em dùng tiện ích HTTP REQUEST HEADER của tiện ích mở rộng của Chrome để phân tích

    Mô tả chi tiết: https://drive.google.com/file/d/1zy-oLcng_8qDtZNJNxW9RwmtmMbRwh22/view

    Đầu vào: trang HTML sv.dut.udn.vn, Mã sinh viên và Mật khẩu
    Đầu ra: chuỗi biểu mẫu đăng nhập mà server sv.dut.udn.vn yêu cầu
 */
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
    return `MainContent_ToolkitScriptManager1_HiddenField=${result1}&MainContent_TabContainer1_ClientState=${result2}&__EVENTTARGET=${result3}&__EVENTARGUMENT=${result4}&__VIEWSTATE=${result5}&__VIEWSTATEGENERATOR=${result6}&__EVENTVALIDATION=${result7}&ctl00%24TextBox1=${$MaSinhVien}&ctl00%24TextBox2=${$MatKhau}&ctl00%24BT_DNhap=%C4%90%C4%83ng+nh%E1%BA%ADp`;
}

/*
    Chức năng: Trả về một danh sách các học phần dựa vào nội dung HTML có được
    Em dùng biểu thức chính quy để phân tích đoạn HTML này
    Hàm truyền vào tham chiếu (ListHocPhan)

    (HTML mẫu: https://drive.google.com/file/d/1jCracBs7pOnxU6o3mAxyO3ys6qVSfGMm/view)

    Đầu vào: chuỗi HTML của trang chứa thông tin học phần và biến dạng tham chiếu ListHocPhan
    Đầu ra: Danh sách các học phần của sinh viên được thiết lập trong biến tham chiếu ListHocPhan
 */
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

/*
    Trả về một danh sách các học phần dựa vào nội dung HTML có được
    Em dùng biểu thức chính quy để phân tích đoạn HTML này
    Hàm truyền vào tham chiếu (ListHocPhan)

    (HTML mẫu: https://drive.google.com/file/d/1zPrXWgr9bTOKHmba4_WF5jjFr7mkblu_/view)

    Đầu vào: chuỗi HTML chứa các thông báo và Loại thông báo
    (Biến Loai có 2 giá trị: "ThongBaoChung" hoặc "ThongBaoThayCo")

    Đầu ra: Danh sách thông báo
 */
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

/*
    Chức năng: lấy danh sách tuần học từ chuỗi HTML

    (HTML mẫu: https://drive.google.com/file/d/1Gtupe4e2lUm01xZHG-KGtVSRN1BqYaZZ/view)

    Đầu vào: chuỗi HTML
    Đầu ra: danh sách các tuần học
 */
function getListTuanHoc($html) {
    const regex1 = RegExp(/>Tuần thứ (.*?)<\/option>/, 'g');
    let array;

    let ListTuanHoc = [];
    while ((array = regex1.exec($html)) !== null) {
        let TuanHoc = {};
        let ans = array[1].split(": ");
        TuanHoc.Tuan = ans[0];
        TuanHoc.ThoiGian = ans[1];
        ListTuanHoc.push(TuanHoc);
    }
    return ListTuanHoc;
}

/*
    Chức năng: phân tích thông tin cá nhân sinh viên từ HTML vào gán vào biến đối tượng SV
    (Trang lấy dữ liệu: http://sv.dut.udn.vn/S_NhanThan.aspx)


    (HTML mẫu: https://drive.google.com/file/d/1ekATCMDz7UdxYlzUJHO2XG5WtTz5jAyZ/view)

    Đầu vào: chuỗi chứa HTML nhân thân sinh viên
    Đầu ra: gán giá trị vào biến SV
 */
function setSinhVien_ThongTinCaNhan(html, SV) {
    let MaSinhVien = html.match(/<input name=".{0,50}TBemail" type="text" value="(.*?)@/);
    let Ten = html.match(/<input name=".{0,50}TBhoten" type="text" value="(.*?)"/);
    let Khoa = html.match(/<input name=".{0,50}TBnganh" type="text" value="(.*?)"/);
    let Lop = html.match(/<input name=".{0,50}TBlop" type="text" value="(.*?)"/);
    let Email = html.match(/<input name=".{0,50}TBemail2" type="text" value="(.*?)"/);

    if (SV === null || MaSinhVien === null || Ten === null || Khoa === null || Lop === null) return false;

    SV.MaSinhVien = MaSinhVien[1];
    SV.Ten = Ten[1];
    SV.Khoa = Khoa[1];
    SV.Lop = Lop[1];
    SV.Email = Email == null ? (SV.MaSinhVien + "@sv.dut.edu.vn") : Email[1];
    return true;
}

/*
    Chức năng: phân tích thông tin về điểm số sinh viên từ HTML vào gán vào biến đối tượng SV
    (Trang lấy dữ liệu: http://sv.dut.udn.vn/S_KQHoctap.aspx)

    (HTML mẫu: https://drive.google.com/file/d/1ekATCMDz7UdxYlzUJHO2XG5WtTz5jAyZ/view)

    Đầu vào: chuỗi chứa HTML thông tin về điểm số sinh viên
    Đầu ra: gán giá trị vào biến SV
 */
function setSinhVien_DiemSo(html, SV) {

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

/*
    Chức năng: Lưu toàn bộ thông tin của sinh viên để khi có thông báo
    server sẽ gửi chính xác đến đúng sinh viên, đúng thiết bị (Token ứng dụng)

    Các thông tin lưu:
    - Thông sinh viên: Tên, mã sinh viên, lớp, khoa, danh sách học phần,....
    - Thông tin thiết bị: Token mà Firebase cấp ghi mở ứng dụng, để thông báo thích hợp đến thiết bị

    Đầu vào: Thông tin sinh viên (SV), Thông tin học phần (ListHocPhan) và Token
 */
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

/*
    Chức năng: lưu thông báo vào cơ sở dữ liệu MySQL, để server ghi nhớ những thông báo đã thông rồi,
    Nếu gặp lại sẽ không thông b áo nữa

    Đầu vào: danh sách thông báo
 */
function SaveThongBaoMySQL(list_thong_bao) {
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

/*
    Chức năng: kiểm tra một thông báo đã tồn tại hay chưa.
    Nếu chưa, tức đây là thông báo mới (trả về TRUE)
    Nếu đã tồn tại, tức là thông báo cũ (trả về FALSE)

    Đầu vào: Biến Thông báo ThongBao
    Đầu ra: True/False
 */
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

/*
    Chức năng: Lưu thông báo trên FIREBASE REALTIME DATABASE để truy cập nhanh, số lượng lớn

    Đầu vào: Danh sách thông báo và mã sinh viên (cần mã sinh viên vì lưu cho đúng nút)
 */
function writeThongBaoToFireBase(ThongBao, MaSinhVien) {
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

/*
    Chức năng: gửi thông báo đến FIREBASE CLOULD MESSAGESING để yêu cầu nó phân phát tin nhắn
    đến thiết bị (registrationTokens chứa các token mà FIREBASE đã cấp cho ứng dụng) thích hợp

    Đầu vào: Thông báo, danh sách token, hàm callback khi nó gửi thành công
    Đầu ra: gửi thành công, hoặc thất bại
 */
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


    const options = {
        priority: "high"
    };


    return admin.messaging().sendToDevice(registrationTokens, payload, options)
        .then(function (response) {
            console.log('Successfully sent message:', response);
            callback();
        })
        .catch(function (error) {
            console.log('Error sending message:', error);
        });

    return true;
}

/*
    Chức năng: ghi danh sách các tuần học lên FIREBASE REALTIME DATABASE
    (Cầu trúc dữ liệu tuần học: https://drive.google.com/file/d/1hg6d10gEzO_gwXHacZt2FuwSvGE5Bajl/view)

    Đầu vào: Danh sách tuần học

 */
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

/*
    Chức năng:
    - Ghi danh sách các học phần của sinh viên vào FIREBASE REALTIME DATABASE, để truy cập nhanh
    - Ghi toàn bộ thông báo chung từ trước đến giờ nếu đây là sinh viên lần đầu tiên đăng nhập vào hệ thống này

    Đầu vào: Danh sách học phần và Mã sinh viên
    Đầu ra: không


 */
function writeToFireBase(ListHocPhan, MaSinhVien) {

    //Ghi từng học phần một vào nút MaSinhVien/HocPhan
    for (let i = 0; i < ListHocPhan.length; i++) {
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

    //Nếu đây là sinh viên mới đăng nhập hệ thống lần đầu tức không có nút MaSinhVien/ThongBaoChung
    //Sẽ tiến hành ghi toàn bộ những thông báo chung trước giờ cho sinh viên này
    database.ref(MaSinhVien + "/ThongBaoChung/").once('value', (snap) => {
        if (snap.val() === null) {
            database.ref("ThongBaoChungToanBo").once('value', (snap) => {
                database.ref(MaSinhVien + "/" + "ThongBaoChung").set(snap.val());
            });
        }
    });
}

/*
    Chức năng: lấy danh sách Token của thiết bị từ rows mà truy vấn được từ MySQL
 */
function getListToken(rows) {
    let registrationTokens = [];
    for (let i = 0; i < rows.length; i++)
        registrationTokens.push(rows[i].Token);
    return registrationTokens;
}


io.sockets.on('connection', function (socket) {

    /*
        Chức năng: Lăng nghe sự kiện đăng nhập mà ứng dụng gửi đến server

        Đầu vào: thông tin đăng nhập (Mã sinh viên, mật khẩu và Token mà Firebase cấp)
        Đầu ra: - Lưu thông tin cá nhân, thông tin học phần vào MySQl, ...
                    trả về đối tượng SinhVien nếu đăng nhập thành công
                - Sai mã sinh hoặc mật khẩu, trả về lỗi, không lưu vào MySQL
     */
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

        // Get trang sv.dut.udn.vn để lấy các tham số cần thiết để đăng nhập
        request.get(URL, function (err, res, body) {
            const post_data = getPostData(body, MaSinhVien, MatKhau);
            if (!Array.isArray(res.headers['set-cookie'])) {
                let err = "Không truy cập được sv.dut.udn.vn để lấy dữ liệu!";
                socket.emit('server-sent-login-reponse', err);
                console.log(MaSinhVien + ": " + err);
                return;
            }
            const cookie = res.headers['set-cookie'][0];

            //Tiến hành đăng nhập
            request.post(URL, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookie
                },
                body: post_data,
                followAllRedirects: true
            }, function (error, response, body) {

                //Lấy thông về điểm số sinh viên
                request.get("http://sv.dut.udn.vn/S_KQHoctap.aspx", {headers: {'Cookie': cookie}}, function (err, res, body) {
                    let status = setSinhVien_DiemSo(body, SV);
                    if (status === false) SV = null;

                    KQHT = 1;
                    callback_login();
                });

                //Lấy thông tin cá nhân của sinh viên
                request.get("http://sv.dut.udn.vn/S_NhanThan.aspx", {headers: {'Cookie': cookie}}, function (err, res, body) {
                    let status = setSinhVien_ThongTinCaNhan(body, SV);
                    if (status === false) SV = null;

                    NhanThan = 1;
                    callback_login();
                });

                //Lấy thông tin về danh sách học phần sinh viên
                request.get("http://sv.dut.udn.vn/S_LichHoc.aspx", {headers: {'Cookie': cookie}}, function (err, res, body) {
                    set_list_hocphan(body, ListHocPhan);

                    DSHocPhan = 1;
                    callback_login();
                });

            });
        });
    });


    /*
        Chức năng: Lắng nghe sự kiện đăng xuất mà ứng dụng gửi đến server

        Đầu vào: Thông tin mà ứng dụng gửi lên server: Mã sinh viên và Token
        Đầu ra: xóa token của ứng dụng mà sinh viên này đã đăng nhập, để không thông báo đến thiết bị này nữa
     */
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

/*
    Chức năng: mỗi khi hàm này được gọi, nó sẽ tiến hành
    lấy dữ liệu từ 3 trang, gồm:
    Trang 1: Thông báo chung:
        http://sv.dut.udn.vn/G_Thongbao.aspx

    Trang 2: Thông báo thầy cô đến lớp học phần
        http://sv.dut.udn.vn/G_Thongbao_LopHP.aspx

    Trang 3: Trang chứa danh sách tuần của mỗi năm học
        http://dut.udn.vn/Lichtuan21

    Sau khi có dữ liệu là những đoạn chuỗi chứa HTMl:

    - Trang 1, 2 sẽ sử dụng hàm đã định nghĩa ở trên là get_list_thong_bao để có được danh sách thông báo.
        + Đối với thông báo chung, sẽ thông báo đến toàn bộ sinh viên có trên Database
        + Đối với thông báo thầy cô, sẽ dựa vào học phần của sinh viên có trên Database để thông báo thích hợp
        Sau cùng, lưu những thông báo này lên FIREBASE REALTIME DATABASE để truy cập được số lượng lớn

    - Trang 2: Sẽ lưu danh dách sách các tuần học trên FIREBASE DATABASE REALTIME

    (Cấu trúc dữ liệu trên FIREBASE DATABASE REALTIME:
    https://drive.google.com/file/d/1hg6d10gEzO_gwXHacZt2FuwSvGE5Bajl/view)

 */
function LayDuLieu() {
    if (list_thong_bao_hien_tai.length === undefined) return;

    //console.log("list_thong_bao_hien_tai.length = " + list_thong_bao_hien_tai.length);
    console.log("Đang lấy dữ liệu từ phía: " + URL);


    //Lấy dữ liệu thông báo chung từ trang thông báo chung
    //http://sv.dut.udn.vn/G_Thongbao.aspx
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
                        SaveThongBaoMySQL([ThongBao]);
                        list_thong_bao_hien_tai.push(ThongBao);
                        const sql = 'SELECT MaSinhVien FROM SINH_VIEN';
                        con.query(sql, function (err, rows) {
                            for (let i = 0; i < rows.length; i++)
                                writeThongBaoToFireBase(ThongBao, rows[i].MaSinhVien);
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


    //Lấy dữ liệu thông báo chung từ trang thông báo thầy cô đến lớp học phần
    //http://sv.dut.udn.vn/G_Thongbao_LopHP.aspx
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

                const sql = `SELECT MaSinhVien,Token FROM LS_THIETBI
                        WHERE MaSinhVien IN (SELECT MaSinhVien FROM SINH_VIEN
                        WHERE MaSinhVien IN (SELECT MaSinhVien FROM DK_HOC_PHAN
                        WHERE MaHocPhan IN (SELECT MaHocPhan
                        FROM HOC_PHAN WHERE POSITION(HOC_PHAN.TenLopHocPhan IN '${ThongBao.TieuDe}') > 0)))`;

                con.query(sql, function (err, rows) {
                    if (err) throw err;

                    let registrationTokens = [];
                    for (let i = 0; i < rows.length; i++) {
                        registrationTokens.push(rows[i].Token);
                        writeThongBaoToFireBase(ThongBao, rows[i].MaSinhVien);
                    }

                    sendToFireBaseCouldMessagesing(ThongBao, registrationTokens, function () {
                        SaveThongBaoMySQL([ThongBao]);
                        list_thong_bao_hien_tai.push(ThongBao);
                    });
                });
            }
        }

        if (CoThongBaoThayCo === false)
            console.log("Không có thông báo thầy cô mới!");

    });


    //Lấy dữ liệu tuần học từ trang
    //http://dut.udn.vn/Lichtuan21
    request.get(URL_LichTuan, function (err, res, body) {

        let ListTuanHoc = getListTuanHoc(body);

        if (ListTuanHoc.length === 0) {
            console.log(`Get list tuan hoc: Lỗi`);
            return;
        }

        writeTuanHocToFireBase(ListTuanHoc);
    });

}

//Tự động gọi hàm LayDuLieu() một cách định kì sau mỗi 5 phút
setInterval(LayDuLieu, 60000 * 60);
