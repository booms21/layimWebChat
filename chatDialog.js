//客服聊天会话功能js
layui.use(["layim", "table", "form", "layer", "upload"], function (layim) {
  (layim = layim), (table = layui.table), (form = layui.form);
  var chatServerUrl = "http://11.12.13.14:9981/"; //聊天服务地址
  var kfId = sessionStorage.getItem("account");
  var url =
    chatServerUrl.replace("http", "ws").replace("https", "wss") +
    "websocket/" +
    kfId; //聊天websocket服务地址

  webSocket = null;
  createWebSocket();
  /**
   * websocket启动
   */
  function createWebSocket() {
    if (kfId) {
      if ("WebSocket" in window) {
        try {
          webSocket = new WebSocket(url);
          initWs(webSocket);
        } catch (e) {
          console.log("catch" + e);
          console.log("------连接失败，聊天连接已关闭...正在重连");
          reconnect();
        }
      } else {
        // 浏览器不支持 WebSocket
        alert(
          "您的浏览器不支持客服发送聊天信息 WebSocket! 请使用新版谷歌浏览器打开网站"
        );
      }
    } else {
      if (webSocket.readyState == WebSocket.CLOSED) {
        reconnect();
        console.log(webSocket.readyState, WebSocket.CLOSED);
      } else {
        console.log("no account");
      }
    }
  }
  function initWs() {
    webSocket.onopen = function () {
      if (webSocket.readyState == 1) {
        heartCheck.start();
      }
      alert("成功进入会话消息接收状态，onopen...");
      window.onbeforeunload = function () {
        webSocket.close();
      };
    };
    //websocket消息接收
    webSocket.onmessage = function (res) {
      heartCheck.start();
      var status = JSON.parse(res.data).status;
      var data = JSON.parse(res.data).data;
      console.log(res);
      if (status == 1) {
        //用户发送消息

        layer.msg("您有新消息");
        layim.getMessage({
          username: data.userName,
          avatar: "../../images/yonghu.png",
          id: data.userId,
          type: "kefu",
          kfId: data.kfId,
          kfName: data.kfId,
          userId: data.userId,
          content: layim.content(data.content),
          timestamp: data.createTime,
        });
        wsuserObj = data;
      }

      if (status == 2) {
        //有新接入
        layer.msg("您有新消息请求接入");
        //新接入的id为userid
        wsuserObj = data;
        wsuserObj.userId = data.id;
      }
      if (status == 5) {
        //转接被拒，消息退回
        layer.alert("目标客服坐席不接受转接，会话保持");
        layim.getMessage({
          username: data.userName,
          avatar: "../../images/yonghu.png",
          id: data.id,
          type: "kefu",
          kfId: kfId,
          kfName: kfId,
          userId: data.id,
          content: "系统消息：目标客服坐席不接受消息转接，会话保持",
          timestamp: new Date().getTime(),
        });
      }

      if (status == 4) {
        //收到坐席转接消息
        layer.open({
          content:
            "您收到一个来自其他坐席转接的会话消息，是否接受处理该用户消息？",
          closeBtn: false,
          btn: ["接受", "不接受"],
          btnAlign: "c",
          yes: function (index, layero) {
            webSocket.send(
              toStr({
                respStatus: 4, //4接受  5不接受
                userId: data.id,
                kfId: kfId,
              })
            );

            layer.close(index);
            layim.getMessage({
              username: data.userName,
              avatar: "../../images/yonghu.png",
              id: data.id,
              type: "kefu",
              kfId: kfId,
              kfName: kfId,
              userId: data.id,
              content: "系统消息：转接成功",
            });
            layim.show();
          },
          btn2: function (index, layero) {
            webSocket.send(
              toStr({
                respStatus: 5,
                userId: data.id,
              })
            );
            layer.close(index);
          },
        });
      }
      if (status == 9) {
        console.warn("----心跳正常pong---", new Date());
      }
    };
    //连接错误
    webSocket.onerror = function (r) {
      // alert("连接错误onerror，聊天连接已关闭...开始重连" + r);
      console.log("断开");
      reconnect();
    };
    webSocket.onclose = function (e) {
      // 关闭 websocket，清空信息板
      // alert("聊天连接已关闭onclose...开始重连---");
      heartCheck.timeoutObj && clearTimeout(heartCheck.timeoutObj);
      heartCheck.serverTimeoutObj && clearTimeout(heartCheck.serverTimeoutObj);
      console.log(
        "websocket 断开: " + e.code + " " + e.reason + " " + e.wasClean
      );
      reconnect();
    };


    //心跳检测
    var heartCheck = {
      timeout: 30000, //每隔30秒发送心跳
      severTimeout: 5000, //服务端超时时间
      timeoutObj: null,
      serverTimeoutObj: null,
      start: function () {
        var _this = this;
        this.timeoutObj && clearTimeout(this.timeoutObj);
        this.serverTimeoutObj && clearTimeout(this.serverTimeoutObj);
        this.timeoutObj = setTimeout(function () {
          //这里发送一个心跳，后端收到后，返回一个心跳消息，
          //onmessage拿到返回的心跳就说明连接正常
          console.warn("----心跳发送ping----", new Date());
          webSocket.send(
            toStr({
              respStatus: 9, //心跳9
              kfId: kfId,
            })
          ); // 心跳包
          //计算答复的超时时间
          _this.serverTimeoutObj = setTimeout(function () {
            console.error("----心跳超时，关闭连接----", new Date());
            webSocket.close();
          }, _this.severTimeout);
        }, this.timeout);
      },
    };
    //避免重复连接
    var lockReconnect = false,
      tt;
    /**
     * websocket重连
     */
    function reconnect() {
      if (lockReconnect) {
        return;
      }
      lockReconnect = true;
      tt && clearTimeout(tt);
      tt = setTimeout(function () {
        console.log("重连中...");
        lockReconnect = false;
        createWebSocket();
      }, 5000);
    }
  }



  //objec转string
  function toStr(obj) {
    return JSON.stringify(obj);
  }

  layim.config({
    //简约模式（不显示主面板）
    brief: true,
    uploadImage: {
      url: "", //（返回的数据格式见下文）
      type: "", //默认post
    },
    mine: {
      username: kfId, //我的昵称
      id: kfId, //我的ID
      status: "online", //在线状态 online：在线、hide：隐身
      sign: "", //我的签名
      avatar: "../../images/kficon.png", //我的头像
    },
    chatLog: "../DialogueManagement/DialogueRecord/DialogueRecordInfo.html", //聊天记录地址
  });
  request({
    url: baseUrl + "personalConfig/getInfo",
    method: "get",
    success: function (res) {
      layim.config({
        brief: true,
        uploadImage: {
          url: "", //（返回的数据格式见下文）
          type: "", //默认post
        },
        mine: {
          username: res.data.name, //我的昵称
          avatar: fileServiceUrl + res.data.image, //我的头像
          id: kfId,
        },
        chatLog: "../DialogueManagement/DialogueRecord/DialogueRecordInfo.html", //聊天记录地址
      });
    },
    error: function (res) {
      console.log("网络错误");
    },
  });
  var wsuserObj = {};

  //点击接入
  $("#openDialog").click(function () {
    if (webSocket == null) {
      alert("接入失败：ws连接服务器失败，请检查网络是否正常!");
      return;
    }
    if (!wsuserObj.userId) {
      alert("当前无用户消息!");
      return;
    }
    layer.confirm(
      "是否确认接入一个新的用户消息会话？",
      function (index) {
        //do something
        webSocket.send(
          toStr({
            respStatus: 2,
            kfId: kfId,
            userId: wsuserObj.id,
            userName: wsuserObj.userName,
          })
        );
        layim.getMessage({
          username: wsuserObj.userName,
          avatar: "../../images/yonghu.png",
          id: wsuserObj.id,
          type: "kefu",
          kfId: kfId,
          kfName: kfId,
          userId: wsuserObj.id,
          content: "系统消息：用户已接入",
        });
        layer.close(index);
        layim.show();
      },
      function (index) {
        //do something
        webSocket.send(
          toStr({
            respStatus: 3,
            kfId: kfId,
            userId: wsuserObj.userId,
            userName: wsuserObj.userName,
          })
        );
        layer.close(index);
      }
    );
  });

  //监听发送消息
  layim.on("sendMessage", function (data) {
    var To = data.to;
    console.log(data);
    if (!webSocket || webSocket.readyState != 1) {
      alert("发送失败，会话消息连接服务器错误ws");
    }
    webSocket.send(
      toStr({
        kfId: data.mine.id,
        kfName: data.mine.username,
        userId: data.to.id,
        userName: data.to.username,
        content: data.mine.content,
      })
    );
  });

  //常用语
  layim.on("commonLang", function (showDialog) {
    commonLangList(showDialog);
  });

  //结束当前会话
  layim.on("endChat", function (data) {
    if (!data.data.userId) {
      layer.msg("当前会话不存在，无法退出");
      return;
    }
    request({
      url: chatServerUrl + "overSession/overUser",
      data: {
        kfId: kfId,
        userId: data.data.userId,
      },
      method: "get",
      success: function (resp) {
        layer.msg(resp.msg);
      },
      error: function (resp) {
        layer.msg("退出失败");
      },
    });
  });

  //转接弹窗
  layim.on("transfer", function (data) {
   // ...
  });

  //layim建立就绪
  layim.on("ready", function (res) {});


  //常用语
  function commonLangList(cb) {
    request({
      url: baseUrl + "sessionComm/sessionCommList",
      isJson: true,
      data: JSON.stringify({
        content: "",
        page: 1,
        pageCount: 999,
        source: "",
      }),
      method: "post",
      success: function (res) {
        var vListDom = "";
        res.data.list.forEach(function (item) {
          vListDom += '<div class="cl-item">' + item.content + "</div>";
        });
        cb && cb('<div class="cl-box">' + vListDom + "</div>");
      },
      error: function (res) {
        console.log(res);
      },
    });
  }
});




