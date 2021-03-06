currentDate = moment().hours(0).minutes(0).seconds(0).milliseconds(0);
periodStartDate = moment().hours(0).minutes(0).seconds(0).milliseconds(0);
periodEndDate = moment().hours(0).minutes(0).seconds(0).milliseconds(0);


$(document).on("pageinit", function () {
    $.mobile.page.prototype.options.domCache = true;
    $.mobile.buttonMarkup.hoverDelay = 0;
    $.mobile.changePage.defaults.allowSamePageTransition = true;
//    $.mobile.defaultDialogTransition = 'none';
//    $.mobile.defaultPageTransition = 'slide';
});

$(document).on("deviceready", function () {
    navigator.splashscreen.hide();
});

$(document).on("pagebeforechange", function (event, data) {
    if (typeof data.toPage === 'object' && data.toPage.attr('data-needs-auth') === 'true') {
        if (!getLoginToken()) {
            returnToPage = '#dayPage';
            event.preventDefault();
            redirectToLogin();
        }
    }
});

function checkAuthentication(loginToken, onError) {
    if (!hasConnection()) {
        navigator.notification.alert(
            'Your device has no network connection',
            function () {
                $.mobile.changePage("#connectionLostPage", {changeHash:false});
            },
            'Connection error',
            'OK'
        );
        return;
    }
    $.mobile.showPageLoadingMsg();
    $.ajax({
        type:'HEAD',
        url:serverUrl + 'checkAuthentication',
        headers:{
            "X-Authentication-Token":JSON.stringify(loginToken)
        },
        cache:false,
        success:function () {
            localStorage.setItem(LOGIN_TOKEN, JSON.stringify(loginToken));
            if (returnToPage) {
                $.mobile.changePage(returnToPage);
            } else {
                $.mobile.changePage("#weekPage");
            }
        },
        error:defaultFunction(onError),
        complete:$.mobile.hidePageLoadingMsg
    });
}

$(document).on('ready', function () {

    var dayPageDomElement = $("#dayPage");
    var weekPageDomElement = $("#weekPage");
    var syncDataOnWeekPage = syncData(weekPageDomElement);
    var syncDataOnDayPage = syncData(dayPageDomElement);

    function addModelViewBinding() {
        dayPageDomElement.on('modelChanged', function () {
            fillDayView();
            fillSelectMenuInDayView();
        });

        weekPageDomElement.on('modelChanged', function () {
            fillWeekView();
        });

        $("#favPage").on('modelChanged', function () {
            fillCurrentListInFavPage();
        });
    }

    function addDayPageEventHandlers() {
        function deleteRegistrationHandler(taskNr) {
            var delreg = {
                taskNumber:taskNr
            };

            var onSuccess = function (data) {
                if (data.indexOf('Already submitted') !== -1) {
                    $.mobile.changePage("#dialogPopUpNoDelete");
                } else {
                    deleteRegistration(taskNr);
                    dayPageDomElement.trigger("modelChanged");
                }
            };

            authenticatedAjax("POST", "hours/deleteRegistration", delreg, onSuccess);
        }

        function postHourRegistration(myData, onSuccess) {
            authenticatedAjax('POST', 'hours/registration', myData, onSuccess);
        }

        $('#prevDayBtn').on("click", function () {
            currentDate = currentDate.subtract('days', 1);
            if (currentDate.diff(periodStartDate, 'days') < 0) {
                syncDataOnDayPage();
            } else {
                dayPageDomElement.trigger("modelChanged");
            }
        });

        $('#nextDayBtn').on("click", function () {
            currentDate = currentDate.add('days', 1);
            if (currentDate.diff(periodEndDate, 'days') > 0) {
                syncDataOnDayPage();
            } else {
                dayPageDomElement.trigger("modelChanged");
            }
        });

        function removeValidationHighlighting() {
            $('#favLabel').removeClass(MISSING);
            $('#hoursLabel').removeClass(MISSING);
        }

        dayPageDomElement.on('pagebeforeshow', function (event) {
            removeValidationHighlighting();
            try {
                fillDayView();
                fillSelectMenuInDayView();
            } catch (error) {
                syncDataOnDayPage();
            }
        });

        $("#dayForm").find("input,select").on("change", removeValidationHighlighting);


        function pulsateTimeEntry(taskNumber) {
            window.setTimeout(function () {
                $("#entry" + taskNumber).effect("pulsate", {times:1}, 600);
            }, 200);
        }

        $('#dayForm').submit(function (event) {
            event.preventDefault();
            var err = false;
            removeValidationHighlighting();
            hourForm = $("#hours").val();

            if ($('#fav').val() === "") {
                $('#favLabel').addClass(MISSING);
                err = true;
            }
            if (hourForm === "0") {
                $('#hoursLabel').addClass(MISSING);
                err = true;
            }

            // Validation error of input fields
            if (err === true) {
                window.setTimeout(removeValidationHighlighting, 2000);
                return false;
            }

            var favForm = $("#fav").val();
            var hourForm = $("#hours").val();
            var lunchForm = $("#lunch").val();
            var selectedFav = favMap[favForm]; //The Favourite object selected in the select box

            var lunchTaskNumber;
            if (lunchForm === "1" && selectedFav.projectNumber !== "LUNSJ" && $.isEmptyObject(weekMap[currentDate.format(DATE_FORMAT)])) {
                postHourRegistration({
                    'projectNumber':'LUNSJ',
                    'activityCode':'LU',
                    'description':'Lunsj',
                    'hours':0.5,
                    'date':currentDate.format(DATE_FORMAT)
                }, function (data) {
                    dayPageDomElement.one("modelChanged", function () {
                        pulsateTimeEntry(data.taskNumber);
                    });
                });
            }

            postHourRegistration({
                'projectNumber':selectedFav.projectNumber,
                'activityCode':selectedFav.activityCode,
                'description':selectedFav.description,
                'hours':hourForm,
                'date':currentDate.format(DATE_FORMAT)
            }, function (data) {
                editTaskNumber = data.taskNumber;
                syncDataOnDayPage();
                dayPageDomElement.one("modelChanged", function () {
                    $.mobile.silentScroll($("#entry" + editTaskNumber).offset().top);
                    pulsateTimeEntry(editTaskNumber);
                });
            });

            return false;
        });


        /*
         * #dayPage
         * Editing of registrations in dayList
         * Listens to click of a list element in dayList
         */
        $('#editReg').on("click", function () {
            var err = false;

            // Reset highlighted form elements
            $('#hoursEditLabel').removeClass(MISSING);

            var editHours = $('#editHours').val();
            var editDescription = $('#editDescription').val();
            var editWorkType = $('#editWorkType').val();

            // Validation error of input fields
            if (err === true) {
                return false;
            }

            var edit = {
                'taskNumber':editTaskNumber,
                'projectNumber':weekMap[currentDate.format(DATE_FORMAT)][editTaskNumber].projectNumber,
                'activityCode':weekMap[currentDate.format(DATE_FORMAT)][editTaskNumber].activityCode,
                'date':currentDate.format(DATE_FORMAT),
                'workType':editWorkType,
                'description':editDescription,
                'hours':editHours
            };

            authenticatedAjax("POST", "hours/updateRegistration", edit, function () {
                syncDataOnDayPage();
                dayPageDomElement.one("modelChanged", function () {
                    $.mobile.silentScroll($("#entry" + editTaskNumber).offset().top);
                    pulsateTimeEntry(editTaskNumber);
                });
            });
        });

        dayPageDomElement.find("#dayList").on("click", ".editEntry", function () {
            editTaskNumber = $(this).attr("id").substring("edit:".length);
            $.mobile.changePage("#dialogEditReg");
        });

        dayPageDomElement.find("#dayList").on("click", ".deleteEntry", function () {
            var taskNumber = $(this).attr("id").substring("delete:".length);
            deleteRegistrationHandler(taskNumber);
        });


    }

    function addWeekPageEventHandlers() {
        weekPageDomElement.find('#prevWeekBtn').on("click", function () {
            currentDate = periodStartDate.subtract('days', 1);
            syncDataOnWeekPage();
        });

        weekPageDomElement.find('#nextWeekBtn').on("click", function () {
            currentDate = periodEndDate.add('days', 1);
            syncDataOnWeekPage();
        });

        /*
         * #weekPage
         * Listens to clicks on list elements in weekPage (Monday, Tuesday etc.)
         * If a day is clicked it navigates to that day in dayView
         */
        weekPageDomElement.find('#weekList').on("click", "li", function () {
            var date = $(this).attr("id").substring("day:".length);
            currentDate = moment(date, DATE_FORMAT);
            $.mobile.changePage("#dayPage");
            dayPageDomElement.trigger("modelChanged");
        });

        weekPageDomElement.on("click", "#submitPeriod", function () {
            var message = "You have logged " + weekStatusMap.totalHours + " hours in the period " +
                periodStartDate.format(DATE_FORMAT) + " to " + periodEndDate.format(DATE_FORMAT) + ".";
            navigator.notification.confirm(
                message,
                function (buttonIndex) {
                    if (buttonIndex === 2) {
                        authenticatedAjax("POST", "hours/submitPeriod", {date:periodStartDate.format(DATE_FORMAT)}, function () {
                            syncDataOnWeekPage();
                        });
                    }
                },
                'Submit period?',
                'Cancel,Submit'
            );
        });

        weekPageDomElement.on("click", "#reopenPeriod", function () {
            var message = "Do you want to reopen period " + periodStartDate.format(DATE_FORMAT) + " to " + periodEndDate.format(DATE_FORMAT) + "?";
            navigator.notification.confirm(
                message,
                function (buttonIndex) {
                    if (buttonIndex === 2) {
                        authenticatedAjax("POST", "hours/reopenPeriod", {date:periodStartDate.format(DATE_FORMAT)}, function () {
                            syncDataOnWeekPage();
                        });
                    }
                },
                'Reopen period?',
                'Cancel,Reopen'
            );
        });
    }

    function addFavPageEventHandlers() {
        /*
         * Listens to a click of "Search Projects" in the Fav page
         * Gets search data from the server and displays results in a a list.
         */
        $('#favBtn').on("click", function () {
            var inputSearch = $("#favSearch").val();
            var searchData = {
                search:inputSearch
            };

            authenticatedAjax('GET', 'hours/searchFavourites', searchData, fillSearchListInFavPage);
        });
    }

    function addErrorPagesEventHandler() {
        $(".errorPageLink").on("click", function () {
            returnToPage = location.hash;
            checkAuthentication(getLoginToken(), function (jqXHR, textStatus, errorThrown) {
                if (jqXHR.status === 403) {
                    redirectToLogin();
                } else if (jqXHR.status >= 500) {
                    $.mobile.hidePageLoadingMsg();
                    navigator.notification.alert(
                        jqXHR.statusText,
                        function () {
                        },
                        'Server error',
                        'OK'
                    );
                }
            });
        });
    }

    function addLoginPageEventHandlers() {
        $('#loginForm').submit(function () {
            var pw = $('[name=password]').val();
            var loginToken = {
                username:$('[name=username]').val(),
                password:saltAndHash(pw)
            };
            checkAuthentication(loginToken, function () {
                $('#loginErr').text("Wrong username/password");
                window.setTimeout(function () {
                    $('#loginErr').empty();
                }, 2000);
                redirectToLogin();
            });
            return false;
        });

        $("#loginForm").find("input,select").on("change", function () {
            $('#loginErr').empty();
        });
    }

    function addSettingPageEventHandlers() {
        $("#logoutBtn").on("click", function () {
            removeLoginToken();
            redirectToLogin();
        });
    }

    addModelViewBinding();
    addDayPageEventHandlers();
    addWeekPageEventHandlers();
    addErrorPagesEventHandler();
    addLoginPageEventHandlers();
//    addFavPageEventHandlers();
    addSettingPageEventHandlers();

    $(document).on("modelChanged", function () {
        if (currentDate.diff(periodEndDate) > 0 || currentDate.diff(periodStartDate) < 0 || periodEndDate.diff(periodStartDate) < 0) {
            throw new Error("Inconsistent periods");
        }
    });

    weekPageDomElement.on('pagebeforeshow', function () {
        try {
            fillWeekView();
        } catch (error) {
            syncDataOnWeekPage();
        }
    });

    $("#dialogEditReg").on("pagebeforeshow", fillEditRegistrationView);

//    $('#favPage').on('pagebeforeshow', function () { });

//    $('#settingsPage').on('pagebeforeshow', function () { });

    syncDataOnDayPage();
})
;

function redirectToLogin() {
    $.mobile.changePage("#loginPage", {
        changeHash:false
    });
}

function getLoginToken() {
    return JSON.parse(localStorage.getItem(LOGIN_TOKEN));
}

function removeLoginToken() {
    localStorage.removeItem(LOGIN_TOKEN);
}

function authenticatedAjax(type, url, data, success) {
    if (!hasConnection()) {
        navigator.notification.alert(
            'Your device has no network connection',
            function () {
                $.mobile.changePage("#connectionLostPage", {changeHash:false});
            },
            'Connection error',
            'OK'
        );
        return;
    }
    $.mobile.showPageLoadingMsg();
    $.ajax({
        type:type,
        url:serverUrl + url,
        cache:false,
//        timeout:10000,
        data:data,
        headers:{
            "X-Authentication-Token":JSON.stringify(getLoginToken())
        },
        success:defaultFunction(success),
        error:function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 403) {
                redirectToLogin();
            } else if (jqXHR.status >= 500) {
                $.mobile.hidePageLoadingMsg();
                navigator.notification.alert(
                    jqXHR.statusText,
                    function () {
                        $.mobile.changePage("#errorPage", {changeHash:false});
                    },
                    'Server error',
                    'OK'
                );

            } else {
                var message = "There was an error connecting to the server.\n";
                switch (jqXHR.statusText) {
                    case 'timeout':
                        message += "The request timed out.";
                        break;
                    case 'notmodified':
                        message += "The request was not modified but was not retrieved from the cache.";
                        break;
                    case 'parsererror':
                        message += "XML/Json format is bad.";
                        break;
                }

                $.mobile.hidePageLoadingMsg();
                if (navigator.notification) {
                    navigator.notification.alert(
                        message,
                        function () {
                            $.mobile.changePage("#connectionLostPage", {changeHash:false});
                        }
                    );
                } else {
                    alert(message);
                    $.mobile.changePage("#connectionLostPage", {changeHash:false});
                }
            }
        },
        complete:function () {
            $.mobile.hidePageLoadingMsg();
        }
    });
}


function syncData(observingDomElement) {
    return function () {
        var onSuccess = function (data) {
            updateFavouriteModel(data.projects);
            updateWeekModel(data);
            if (observingDomElement) {
                observingDomElement.trigger("modelChanged");
            }
        };

        authenticatedAjax("GET", "hours/week", {date:currentDate.format(DATE_FORMAT)}, onSuccess);
    }
}

function addFavourites(pNr, aC) {
    var data = {
        'projectNumber':pNr,
        'activityCode':aC
    };
    var onSuccess = function () {
        syncData($("#favPage"))();
        alert('Added project with nr ' + pNr + ' to favourite list');

    };
    authenticatedAjax("POST", "hours/addFavourites", data, onSuccess);
}

function deleteFavourite(key) {
    var fav = favMap[key];
    var delFavourite = {
        'projectNumber':fav.projectnumber,
        'activityCode':fav.activitycode
    };

    var onSuccess = function () {
        alert('Deleted project with nr ' + fav.projectnumber + ' from favourite list');
        $('#favList').children().remove('li');
        syncData($("#favPage"))();
    };

    authenticatedAjax("POST", "hours/deleteFavourite", delFavourite, onSuccess);

}