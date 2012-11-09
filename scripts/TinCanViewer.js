/*
   Copyright 2012 Rustici Software, LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

TinCan.enableDebug();

var TINCAN = (TINCAN || {});

TINCAN.Viewer = function () {
    this.log("TINCAN.Viewer constructor");
    var i,
        lrs;

    this.includeRawData = true;
    this.allVersions = ["0.9", "0.95"];
    this.multiVersionStream = null;
    this.lrses = {};

    for (i = 0; i < this.allVersions.length; i += 1) {
        this.log("TINCAN.Viewer version: " + this.allVersions[i]);
        this.lrses[this.allVersions[i]] = new TinCan.LRS (
            {
                endpoint: Config.endpoint,
                auth: 'Basic ' + Base64.encode(Config.authUser + ':' + Config.authPassword),
                version: this.allVersions[i]
            }
        );
    }
};

if (typeof console !== "undefined") {
    TINCAN.Viewer.prototype.log = function (str) {
        console.log(str);
    };
}
else {
    TINCAN.Viewer.prototype.log = function (str) {};
}

TINCAN.Viewer.prototype.getCallback = function (callback) {
    var tcViewer = this;
    return function () { callback.apply(tcViewer, arguments); };
};

TINCAN.Viewer.prototype.getMultiVersionStream = function (versionList) {
    var lrsList = [],
        i;

    for (i = 0; i < versionList.length; i += 1) {
        lrsList.push(this.lrses[versionList[i]]);
    }

    return new TINCAN.MultiLrsStatementStream(lrsList);
};

TINCAN.Viewer.prototype.TinCanSearchHelper = function () {
    this.getActor = function () {
        var actor,
            actorJson = this.getSearchVar("actorJson"),
            actorEmail = this.getSearchVar("actorEmail");

        if (typeof actorJson !== "undefined" && actorJson.length > 0) {
            actor = TinCan.Actor.fromJSON(actorJson);
        }
        else if (typeof actorEmail !== "undefined") {
            actor = new TinCan.Agent(
                {
                    mbox: actorEmail
                }
            );
        }
        return actor;
    };

    this.getVerb = function () {
        return this.getSearchVar("verb");
    };

    this.getObject = function () {
        var obj = null,
            objectJson = this.getSearchVar("objectJson"),
            activityId;

        if (typeof objectJson !== "undefined") {
            obj = JSON.parse(objectJson);
        } else {
            activityId = this.getSearchVar("activityId");
            if (typeof activityId !== "undefined") {
                obj = {
                    id: activityId
                };
            }
        }
        return obj;
    };

    this.getRegistration = function () {
        return this.getSearchVar("registration");
    };

    this.getContext = function () {
        return this.getSearchVarAsBoolean("context", "false");
    };

    this.getSince = function () {
        var since = this.getSearchVar("since");
        if (since !== null && !this.dateStrIncludesTimeZone(since)) {
            since = since + "Z";
        }
        return since;
    };

    this.getUntil = function () {
        var until = this.getSearchVar("until");
        if (until !== null && !this.dateStrIncludesTimeZone(until)) {
            until = until + "Z";
        }
        return until;
    };

    this.getAuthoritative = function () {
        return this.getSearchVarAsBoolean("authoritative", "true");
    };

    this.getSparse = function () {
        return this.getSearchVarAsBoolean("sparse", "false");
    };

    this.getInstructor = function () {
        var instructorJson = this.getSearchVar("instructorJson");
        if (typeof instructorJson !== "undefined") {
            return JSON.parse(instructorJson);
        }
        return null;
    };

    this.getVersion = function () {
        return this.getSearchVar("version") || "all";
    };

    this.dateStrIncludesTimeZone = function (str) {
        return typeof str !== "undefined" && (str.indexOf("+") >= 0 || str.indexOf("Z") >= 0);
    };

    this.nonEmptyStringOrNull = function (str) {
        return (typeof str !== "undefined" && str.length > 0) ? str : null;
    };

    this.getSearchVar = function (searchVarName, defaultVal) {
        var myVar = $("#"+searchVarName).val();
        if (myVar === null || myVar.length < 1) {
            return defaultVal;
        }
        return myVar;
    };

    this.getSearchVarAsBoolean = function (searchVarName, defaultVal) {
        return $("#"+searchVarName).is(":checked");
    };
};

TINCAN.Viewer.prototype.TinCanFormHelper = function () {
    this.copyQueryStringToForm = function () {
        var booleanVals = ["context", "authoritative", "sparse"];
        var qsMap = this.getQueryStringMap();
        for (var key in qsMap) {
            var inputType = ($.inArray(key, booleanVals) >= 0) ? "checkbox" : "text";
            this.setInputFromQueryString(key, qsMap[key], inputType);
        }
    };

    this.setInputFromQueryString = function (name, val, inputType) {
        if (inputType === null) {
            inputType = "text";
        }
        if (val !== null) {
            if (inputType === "text") {
                $("#"+name).val(val);
            }
            else if (inputType === "checkbox"){
                if (val === "true") {
                    $("#"+name).attr('checked', 'checked');
                } else {
                    $("#"+name).removeAttr('checked');
                }
            }
        }
    };

    this.getQueryStringMap = function () {
        var qs = window.location.search,
            nameVals,
            qsMap,
            i,
            keyVal;
        if (qs === null || qs.length < 1){
            return [];
        }
        if (qs.indexOf("#") > 0){
            qs = qs.substring(0, qs.indexOf("#"));
        }
        qs = qs.substring(1, qs.length);
        nameVals = qs.split("&");
        qsMap = {};
        for (i = 0; i < nameVals.length; i += 1) {
            keyVal = nameVals[i].split("=");
            qsMap[keyVal[0]] = decodeURIComponent(keyVal[1].replace(/\+/g, " "));
        }
        return qsMap;
    };
};

TINCAN.Viewer.prototype.searchStatements = function () {
    var selectVersion,
        versionsToUse,
        helper = new this.TinCanSearchHelper(),
        queryObj = new TINCAN.StatementQueryObject();

    queryObj.actor = helper.getActor();
    queryObj.verb = helper.getVerb();
    queryObj.object = helper.getObject();
    queryObj.registration = helper.getRegistration();
    queryObj.context = helper.getContext();
    queryObj.since = helper.getSince();
    queryObj.until = helper.getUntil();
    queryObj.authoritative = helper.getAuthoritative();
    queryObj.sparse = helper.getSparse();
    queryObj.instructor = helper.getInstructor();
    queryObj.limit = 25;

    selectVersion = helper.getVersion();

    // Figure out the versions to use
    if (selectVersion === "all") {
        versionsToUse = this.allVersions;
    } else {
        versionsToUse = [ selectVersion ];
    }

    // TODO: restore this
    // Set the TCAPI query text
    //var url = this.getDriver().recordStores[0].endpoint + "statements?" + queryObj.toString();
    //$("#TCAPIQueryText").text(url);

    this.multiVersionStream = this.getMultiVersionStream(versionsToUse);
    this.multiVersionStream.loadStatements(queryObj, this.getCallback(this.statementsFetched));
};

TINCAN.Viewer.prototype.getMoreStatements = function (callback) {
    this.multiVersionStream.loadStatements("more", this.getCallback(this.statementsFetched));
};

TINCAN.Viewer.prototype.statementsFetched = function (multiStream) {
    var unwiredDivs;

    // If this query led no where, show no statements available method
    if (multiStream.exhausted()) {
        $("#statementsLoading").hide();
        $("#noStatementsMessage").show();
    }

    // Alright, render all available statements
    $("#statementsLoading").hide();
    $("#theStatements").append(
        this.renderStatements(
            multiStream.getAllStatements()
        )
    );

    // Hook up the "show raw data" links
    unwiredDivs = $('div[tcid].unwired');
    unwiredDivs.click(function () {
        $('[tcid_data="' + $(this).attr('tcid') + '"]').toggle();
    });
    unwiredDivs.removeClass('unwired');

    // Show more button?
    $("#showAllStatements").toggle(!multiStream.exhausted());
};

TINCAN.Viewer.prototype.renderStatements = function (statements) {
    var allStmtStr,
        i,
        dt,
        aDate,
        stmtStr,
        stmt,
        verb,
        objDesc,
        answer,
        activityType;

    function escapeHTML (text) {
        var html = text + "";
        return html.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function truncateString (str, length) {
        if (str === null || str.length < 4 || str.length <= length) {
            return str;
        }
        return str.substr(0, length - 3) + '...';
    }

    // TODO: is any of this better off in TinCanJS?
    function getResponseText (stmt) {
        var response,
            objDef,
            componentName = null,
            components,
            responses,
            responseStr = [],
            first = true,
            responseId,
            i,
            j,
            source,
            target,
            responseParts;

        if (stmt.result === null || stmt.result.response === null) {
            return "";
        }
        response = stmt.result.response;

        if (stmt.target === null ||
            stmt.target.definition === null ||
            stmt.target.definition.type !== "cmi.interaction" ||
            stmt.target.definition.interactionType === null
        ) {
            return response;
        }
        objDef = stmt.target.definition;

        // TODO: move the splitting on [,] of the values into TinCanJS
        if (objDef.interactionType === "matching") {
            if (objDef.source !== null &&
                objDef.source.length > 0 &&
                objDef.target !== null &&
                objDef.target.length > 0
            ) {
                source = objDef.source;
                target = objDef.target;

                responses = response.split("[,]");

                for (i = 0; i < responses.length; i += 1) {
                    responseParts = responses[i].split("[.]");

                    for (j = 0; j < source.length; j += 1) {
                        if (responseParts[0] === source[j].id) {
                            if (!first) {
                                responseStr.push(", ");
                            }
                            responseStr.push(source[j].getLangDictionaryValue("description"));
                            first = false;
                        }
                    }
                    for (j = 0; j < target.length; j += 1) {
                        if (responseParts[1] === target[j].id) {
                            responseStr.push(" -> ");
                            responseStr.push(target[j].getLangDictionaryValue("description"));
                        }
                    }
                }
            }
        } else {
            if (objDef.interactionType === "choice" || objDef.interactionType === "sequencing") {
                componentName = "choices";
            }
            else if (objDef.interactionType === "likert") {
                componentName = "scale";
            }
            else if (objDef.interactionType === "performance") {
                componentName = "steps";
            }

            if (componentName !== null) {
                components = objDef[componentName];

                if (components !== null && components.length > 0){
                    responses = response.split("[,]");

                    for (i = 0; i < responses.length; i += 1) {
                        for (j = 0; j < components.length; j += 1) {
                            responseId = responses[i];
                            if (objDef.interactionType === "performance"){
                                responseId = responses[i].split("[.]")[0];
                            }
                            if (responseId === components[j].id) {
                                if (!first) {
                                    responseStr.push(", ");
                                }
                                responseStr.push(components[j].getLangDictionaryValue("description"));

                                if (objDef.interactionType === "performance") {
                                    responseStr.push(" -> ");
                                    responseStr.push(responses[i].split("[.]")[1]);
                                }
                                first = false;
                            }
                        }
                    }
                }
            }
        }

        if (responseStr.length > 0) {
            return responseStr.join("");
        }

        return response;
    }

    allStmtStr = [];
    allStmtStr.push("<table>");

    for (i = 0; i < statements.length; i += 1) {
        stmtStr = [];
        stmt = statements[i];

        stmtStr.push("<tr class='statementRow'>");
        stmtStr.push("<td class='date'><div class='statementDate'>" + (stmt.stored !== null ? stmt.stored.replace('Z','') : "") + "</div></td>");
        stmtStr.push("<td>");
        stmtStr.push("<div class='statement unwired' tcid='" + stmt.id + "'>");

        try {
            stmtStr.push("<span class='actor'>" + escapeHTML(stmt.actor) + "</span>");

            if (stmt.context !== null &&
                stmt.context.extensions !== null &&
                typeof stmt.context.extensions.verb !== "undefined"
            ) {
                verb = stmt.context.extensions.verb;
            } else {
                verb = stmt.verb + "";
            }

            if (verb === "interacted") {
                verb = "interacted with";
            } else if (stmt.inProgress === true) {
                verb = verb + " (in progress)";
            }

            answer = null;

            if (typeof stmt.target.definition !== null) {
                activityType = stmt.target.definition.type;
                if (activityType !== null && (activityType === "question" || activityType.indexOf("interaction") >= 0)) {
                    if (stmt.result !== null) {
                        if (stmt.result.success !== null) {
                            verb = (stmt.result.success ? "correctly " : "incorrectly ") + verb;
                        }
                        if (stmt.result.response !== null) {
                            answer = " with response '" + escapeHTML(truncateString(getResponseText(stmt), 30)) + "' ";
                        }
                    }
                }
            }

            stmtStr.push(" <span class='verb'>" + escapeHTML(verb) + "</span>");
            stmtStr.push(" <span class='object'>'" + escapeHTML(stmt.target) + "'</span>");
            stmtStr.push(answer !== null ? answer : ".");

            if (stmt.result !== null && stmt.result.score !== null) {
                if (stmt.result.score.scaled !== null) {
                    stmtStr.push(" with score <span class='score'>" + Math.round((stmt.result.score.scaled * 100.0)) + "%</span>");
                } else if (stmt.result.score.raw !== null) {
                    stmtStr.push(" with score <span class='score'>" + stmt.result.score.raw + "</span>");
                }
            }
        }
        catch (error) {
            this.log("Error occurred while trying to display statement with id " + stmt.id + ": " + error.message);
            stmtStr.push("<span class='stId'>" + stmt.id + "</span>");
        }
        stmtStr.push("</div>");

        if (this.includeRawData) {
            stmtStr.push("<div class='tc_rawdata' tcid_data='" + stmt.id + "'>");
            stmtStr.push("<pre>" + stmt.originalJSON + "</pre>");
            stmtStr.push("</div>");
        }

        stmtStr.push("</td></tr>");
        allStmtStr.push(stmtStr.join(''));
    }
    allStmtStr.push("</table>");

    return allStmtStr.join('');
};

TINCAN.Viewer.prototype.pageInitialize = function () {
    var tcViewer = this;

    $.datepicker.setDefaults(
        {
            dateFormat: "yy-mm-dd",
            constrainInput: false
        }
    );
    $("#since").datepicker();
    $("#until").datepicker();

    $("#statementsLoading").show();
    $("#showAllStatements").hide();
    $("#noStatementsMessage").hide();

    $("#refreshStatements").click(
        function () {
            $("#statementsLoading").show();
            $("#showAllStatements").hide();
            $("#noStatementsMessage").hide();
            $("#theStatements").empty();
            tcViewer.searchStatements();
        }
    );

    $("#showAllStatements").click(
        function () {
            $("#statementsLoading").show();
            tcViewer.getMoreStatements();
        }
    );

    $("#showAdvancedOptions").click(
        function () {
            $("#advancedSearchTable").toggle(
                'slow',
                function () {
                    var visible = $("#advancedSearchTable").is(":visible"),
                        text = (visible ? "Hide" : "Show") + " Advanced Options";
                    $("#showAdvancedOptions").html(text);
                }
            );
        }
    );

    $("#showQuery").click(
        function () {
            $("#TCAPIQuery").toggle(
                'slow',
                function () {
                    var visible = $("#TCAPIQuery").is(":visible"),
                        text = (visible ? "Hide" : "Show") + " TCAPI Query";
                    $("#showQuery").html(text);
                }
            );
        }
    );

    (new this.TinCanFormHelper()).copyQueryStringToForm();
};
