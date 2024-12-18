// ==UserScript==
// @name         出勤时长统计
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       guxj
// @match        https://c.bosyun.cn/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==
// update 2022-12-22 by guxj
(async function () {
    'use strict';



    const k_todayDate = new Date();

    let m_todaySignJson = {
        "signin_time": "",
        "signout_time": ""
    }

    function getFileName(date) {
        const yourName = "guxj";
        return `${yourName}-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    async function getLocalFile() {
        const rootUrl = "http://127.0.0.1:888";
        function getUrl(name) {
            return `${rootUrl}/${name}.json`;
        }
        async function checkURL(url) {
            try {
                const response = await fetch(url, { method: 'HEAD' });
                return response.ok; // 如果响应状态为 200-299，则表示有效
            } catch (error) {
                return false; // 网络错误或无效的 URL
            }
        }
        let isUrlValid = await checkURL(rootUrl);
        if (!isUrlValid) {
            return null;
        }
        let lastDay = k_todayDate;
        let res;
        let isFind = false;
        let i = 0;
        while (!isFind && i < 30) {
            try {
                const oneDay = 1000 * 60 * 60 * 24;
                lastDay = new Date(lastDay.getTime() - oneDay);
                const fileName = getFileName(lastDay);
                const url = getUrl(fileName);
                res = await fetch(url);
                if (res.status !== 200) {
                    throw "err";
                }
                isFind = true;
            } catch (error) {
                i++;
            }
        }
        if (res?.status === 200) {
            const buffer = await res.arrayBuffer();
            let file = new File([buffer], "");
            return file;
        } else {
            return null;
        }
    }



    const legalAttendanceDaysMap = {
        "2024": {
            "1": 22,
            "2": 18,
            "3": 21,
            "4": 22,
            "5": 21,
            "6": 19,
            "7": 23,
            "8": 22,
            "9": 21,
            "10": 19,
            "11": 21,
            "12": 22
        },
        "2025": {
            "1": 19,
            "2": 19,
            "3": 21,
            "4": 22,
            "5": 19,
            "6": 20,
            "7": 23,
            "8": 21,
            "9": 23,
            "10": 18,
            "11": 20,
            "12": 23
        }
    }


    function getLegalAttendanceDays(year, month) {
        try {
            return legalAttendanceDaysMap[year][month];
        } catch (error) {
            return -1;
        }
    }

    // 月度考勤信息
    class GuMonthlyAttendanceInfo {
        dayCount;
        totalTime;
        overtime_9;
        overtime_10;
        year;
        month;

        constructor(dayCount, totalTime, overtime_9, overtime_10, year, month) {
            this.dayCount = dayCount;
            this.totalTime = totalTime;
            this.overtime_9 = overtime_9;
            this.overtime_10 = overtime_10;
            this.year = year;
            this.month = month;
        }

        getAvgTime() {
            if (this.dayCount === 0) {
                return "0";
            }
            return (this.totalTime / this.dayCount).toFixed(3);
        }

        showInfo() {
            const avgTime = this.getAvgTime();
            const infoText = `${this.month}月 - 平均时长: ${avgTime}, 交通补贴: ${this.overtime_10 * 50}, 
            晚餐补贴: ${this.overtime_9 * 30}, 出勤天数: ${this.dayCount}/${getLegalAttendanceDays(this.year, this.month)}`;
            console.log(infoText);
            addInfoToHtml(infoText);
        }
    }

    function addInfoToHtml(infoText) {
        var ul = document.getElementById("list");
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(infoText));
        ul.appendChild(li);
    }

    class GuMonthlyAttendanceInfoCalculator {
        startTimeHour;
        endTimeHour;
        startOverTimeHour;
        constructor(startTimeHour, endTimeHour, startOverTimeHour) {
            this.startTimeHour = startTimeHour;
            this.endTimeHour = endTimeHour;
            this.startOverTimeHour = startOverTimeHour;
        }

        calcAvgTime(attendanceData, year, month) {
            let dayCount = 0;
            let totalTime = 0;
            let overtime_9 = 0;
            let overtime_10 = 0;
            for (let i = attendanceData.length - 1; i >= 0; i--) {
                let signinTime = attendanceData[i].signinTime;
                let signoutTime = attendanceData[i].signoutTime;
                // 计算加班费
                if (signoutTime.getHours() >= 22) {
                    overtime_9++;
                    overtime_10++;
                } else if (signoutTime.getHours() >= 21) {
                    overtime_9++;
                }
                // 不统计在开始计算时长前的数据
                if (signinTime.getHours() < this.startTimeHour) {
                    signinTime.setHours(this.startTimeHour);
                    signinTime.setMinutes(0);
                    signinTime.setSeconds(0);
                }
                // 不统计晚饭的时长
                const dinnerTime = (this.startOverTimeHour - this.endTimeHour) * 60 * 60 * 1000;
                if (signoutTime.getHours() < this.endTimeHour) {
                    signoutTime.setTime(signoutTime.getTime() + dinnerTime);
                } else if (signoutTime.getHours() < this.startOverTimeHour) {
                    signoutTime.setHours(this.startOverTimeHour);
                    signoutTime.setMinutes(0);
                    signoutTime.setSeconds(0);
                }
                const lunchTime = 90 * 60 * 1000;
                const dayTime = (signoutTime.getTime() - signinTime.getTime() - lunchTime - dinnerTime) / (1000 * 60 * 60);
                if (dayTime >= 7) { // 小于7小时为请假，不计时长
                    dayCount++;
                    totalTime += dayTime;
                }
            }
            return new GuMonthlyAttendanceInfo(dayCount, totalTime, overtime_9, overtime_10, year, month);
        }
    }

    class GuAttendanceModel {
        m_attendanceData;
        m_curIndex = -1;
        constructor(data) {
            if (data == null) {
                this.m_attendanceData = [];
            } else {
                this.m_attendanceData = JSON.parse(data);
                this.m_curIndex = this.m_attendanceData.length - 1;
            }
        }

        readOneMonthData() {
            let yearNow;
            let monthNow;
            let dayNow;
            let list = [];
            for (; this.m_curIndex >= 0; this.m_curIndex--) {
                const dayJson = this.m_attendanceData[this.m_curIndex];
                const signinText = dayJson.signin_time.replace(/-/g, '/');
                const signoutText = dayJson.signout_time.replace(/-/g, '/');
                if (signinText === "" || signoutText === "") {
                    continue;
                }
                let signinTime = new Date(signinText);
                let signoutTime = new Date(signoutText);

                if (monthNow == null) {
                    monthNow = signinTime.getMonth();
                    yearNow = signinTime.getFullYear();
                } else if (monthNow != signinTime.getMonth()) {
                    return { list: list, year: yearNow, month: monthNow + 1 };
                }
                // 不统计重复的日期
                if (dayNow === signinTime.getDate()) {
                    continue;
                } else {
                    dayNow = signinTime.getDate();
                }
                list.push({
                    signinTime: signinTime,
                    signoutTime: signoutTime
                });
            }
            return { list: list, year: yearNow, month: monthNow ?? -1 + 1 };
        }
    }


    function caclAvgTime(monthData) {
        let calculator = new GuMonthlyAttendanceInfoCalculator(8, 18, 19);
        let info = calculator.calcAvgTime(monthData.list, monthData.year, monthData.month);
        info.showInfo();
        return info.getAvgTime();
    }

    async function updateAttendance() {
        function downloadFile(data, fileName) {
            const blob = new Blob([data]);
            const blobURL = window.URL.createObjectURL(blob);
            const tempLink = document.createElement("a");
            tempLink.style.display = "none";
            tempLink.href = blobURL;
            tempLink.setAttribute("download", fileName);
            if (typeof tempLink.download === "undefined") {
                tempLink.setAttribute("target", "_blank");
            }
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            setTimeout(() => {
                window.URL.revokeObjectURL(blobURL);
            }, 100);
        }

        m_attendanceData.push(m_todaySignJson); // 写入数据
        let text = JSON.stringify(m_attendanceData);
        downloadFile(new Blob([text]), `${getFileName(k_todayDate)}.json`);
    }

    let init = false;
    let m_avgTimeText;

    const callback = function (mutationsList, observer) {
        for (let mutation of mutationsList) {
            const node = mutation?.target;
            if (node?.nodeType === 3 || node?.nodeName === "#text") {
                if (node?.parentElement?.className === "signin_time" && !init) {
                    init = true;
                    m_todaySignJson.signin_time = node?.nodeValue;
                    // 生成平均时长结点
                    const avgTimeNode = document.createElement("span");
                    avgTimeNode.appendChild(m_avgTimeText);
                    avgTimeNode.className = "signin_time";
                    avgTimeNode.style.marginLeft = "16px"
                    const textNode = node?.parentElement?.parentElement;
                    textNode.appendChild(avgTimeNode);
                } else if (node?.parentElement?.className === "signout_time") {
                    m_todaySignJson.signout_time = node?.nodeValue;
                    updateAttendance();
                    observer.disconnect();
                }
            }
        }
    };

    let model;

    const fileData = await (await getLocalFile())?.text();
    if (fileData == null) {
        addInfoToHtml("数据加载失败");
        return;
    } else {
        model = new GuAttendanceModel(fileData);
        let monthData = model.readOneMonthData();
        m_avgTimeText = document.createTextNode(caclAvgTime(monthData));
    }

    // 绑定按钮点击事件
    document.getElementById('clickMe').addEventListener('click', function () {
        caclAvgTime(model.readOneMonthData());
    });

    // 油猴插件修改页面处理
    const observer = new MutationObserver(callback);
    observer.observe(document, { characterData: true, subtree: true });

})();