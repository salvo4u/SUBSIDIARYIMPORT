/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */
/*
Name                : Netsuite Subsidiary Assistance.js
Purpose             : Script to mass create subsidiary records in netsuite.
Created On          : 02/15/2018.
Script Type         : Map Reduce 
Script Owner        : Naveen Cheripelly/Aswini Priyanka
*/
/***************************************
Script Type     : Map/Reduce
Purpose         : Mass create subsidiary records from a file triggered from Netsuite Subsidiary assistance.
***************************************/
define(['N/file', 'N/runtime', 'N/record', 'N/log', 'N/search', 'N/error', 'N/email'],
    function(file, runtime, record, log, search, error, email) {
        function getInputData() {
            try {

                var scriptObj = runtime.getCurrentScript();
                var newFileData = scriptObj.getParameter({
                    name: 'custscript_new_file_data'
                });
                log.debug('newFileData', newFileData);
                if (newFileData && newFileData != null) {
                    fileLoadId = newFileData;
                    var contents = file.load({
                        id: fileLoadId
                    }).getContents().split('\n');
                    contents = contents.slice(0, -1);
                    log.debug('contents', contents);
                    return contents;
                }
            } catch (err) {
                log.debug('Error in getting input data', err);
            }
        }

        var fieldInternalId = [];
        var stateInternalId = [];
        var parentArray = [];
        var currencyArray = [];

        var subsidiarySearchResult = [];
        var errorDetailsArray = [];
        var errorCSVDataHeader = '';

        function map(context) {
            try {

                log.debug('context', context);
                var scriptErrorparamId = runtime.getCurrentScript().getParameter("custscript_errorlogs_folderid");
                var scriptAdminparamId = runtime.getCurrentScript().getParameter("custscript_system_admin");
                var scriptsubsidiaryparamId = runtime.getCurrentScript().getParameter("custscript_subsidiary_internalid_fileid");
                var scriptstateparamId = runtime.getCurrentScript().getParameter("custscript_state_internalid_fileid");

                var errorCSVDetail = '';
                if (context.key == 0) {

                    var subsidiaryInternal = file.load({
                        id: scriptsubsidiaryparamId
                    });
                    var subsidiaryKey = JSON.parse(subsidiaryInternal.getContents());
                    log.debug('subsidiaryKey', subsidiaryKey['Subsubsidiary of']);
                    var headerData = context.value.replace("\r", "");
                    headerData = headerData.split(",");
                    errorCSVDataHeader = errorCSVDataHeader + 'ERROR,';
                    for (i = 0; i < headerData.length; i++) {
                        log.debug('header data', headerData[i]);
                        var headerLabel = headerData[i];
                        if (i < headerData.length - 1)
                            errorCSVDataHeader = errorCSVDataHeader + headerLabel + ",";
                        else
                            errorCSVDataHeader = errorCSVDataHeader + headerLabel + "\n";


                        fieldInternalId.push(subsidiaryKey[headerLabel]);
                    }
                    context.write(errorCSVDataHeader);
                    var stateInternalKey = file.load({
                        id: scriptstateparamId
                    });
                    log.debug('stateInternalId', stateInternalKey.getContents());
                    var stateKey = JSON.parse(stateInternalKey.getContents());
                    stateInternalId = stateKey;
                    log.debug('stateInternalKey', stateInternalKey.getContents());

                    log.debug('fieldinternalid', fieldInternalId);
                    var subsidiarySearch = search.load({
                        id: 'customsearchparent_subsidiary_search'
                    });
                    var searchSubsidiaryResults = subsidiarySearch.run();
                    var companyCodeSearch = searchSubsidiaryResults.getRange({
                        start: 0,
                        end: 1000
                    });
                    log.debug('companyCodeSearch length', companyCodeSearch.length);


                    if (companyCodeSearch.length > 0) {
                        var parentObj = [];
                        for (i = 0; i < companyCodeSearch.length; i++) {
                            var parent = {};
                            parent["id"] = companyCodeSearch[i].id;
                            parent["name"] = companyCodeSearch[i].getValue(companyCodeSearch[i].columns[0]);
                            parentObj.push(parent);
                        }
                    }
                    parentArray = parentObj;
                    log.debug('parentArray', parentArray);
                    var currencyCodeSearch = search.load({
                        id: 'customsearch_currency_search'
                    });
                    var currencyCodeSearchResults = currencyCodeSearch.run();
                    var currenciesCodeSearch = currencyCodeSearchResults.getRange({
                        start: 0,
                        end: 1000
                    });
                    log.debug('currenciesCodeSearch length', currenciesCodeSearch.length);

                    if (currenciesCodeSearch.length > 0) {
                        for (i = 0; i < currenciesCodeSearch.length; i++) {
                            var currency = {};
                            currency["id"] = currenciesCodeSearch[i].id;
                            currency["name"] = currenciesCodeSearch[i].getValue(currenciesCodeSearch[i].columns[0]);
                            currencyArray.push(currency);
                        }
                    }
                    log.debug('currencyArray', currencyArray);
                } else {

                    var headerData = context.value.split(",");
                    var subsidiaryRec = '';
                    var subrec = '';
                    var enteredSubrec = false;
                    var shortname = '';

                    for (var n = 0; n < headerData.length; n++) {
                        log.debug("entered company code search ");
                        log.debug("headerData[n]",headerData[n]);
                        if (fieldInternalId[n] == 'custrecord_companycode') {
                            log.debug("headerData[n]",headerData[n]);
                            var searchforexistingSub = search.create({
                                type: "subsidiary",
                                filters: [
                                    ["custrecord_companycode", "is", headerData[n]]
                                ]
                            });
                            var searchforexistingSubOj = searchforexistingSub.run();
                            var isCompCodeFound = searchforexistingSubOj.getRange({
                                start: 0,
                                end: 1
                            });
                            log.debug("isCompCodeFound.length",isCompCodeFound.length);
                            if (isCompCodeFound && isCompCodeFound.length > 0) {
                                 subsidiaryRec = record.load({
                                    type: record.Type.SUBSIDIARY,
                                    id: isCompCodeFound[0].id,
                                    isDynamic: true
                                });

                            } else {
                                 subsidiaryRec = record.create({
                                    type: record.Type.SUBSIDIARY
                                });
                            }


                        }
                    }
                    for (var n = 0; n < headerData.length; n++) {
                        ////////////////////////Updating the Subsidiary if already exists///
                        
                        //////////////
                        log.debug("fieldInternalId[n]",fieldInternalId[n]);
                        if (fieldInternalId[n] == 'state' && enteredSubrec == false) {
                            
                            var stateName = stateInternalId[headerData[n]];
                            log.debug('state name', stateName);

                            if (stateName == "" || null == stateName) {
                                subsidiaryRec.setValue(fieldInternalId[n], headerData[n]);
                            } else {
                                var stateRecord = record.load({
                                    type: 'state',
                                    id: stateName,
                                    isDynamic: true,
                                });
                                shortname = stateRecord.getValue('shortname');
                                subsidiaryRec.setValue(fieldInternalId[n], shortname);
                            }
                        } else if (fieldInternalId[n] == 'parent') {
                            var parentInternalId = '';
                            for (j = 0; j < parentArray.length; j++) {
                                if (parentArray[j].name == headerData[n]) {
                                    log.debug('found matched');
                                    parentInternalId = parentArray[j].id
                                }
                            }
                            if (!isNotNull(parentInternalId)) {
                                log.debug('entering parent not found');
                                var subsidiarySearch = search.load({
                                    id: 'customsearchparent_subsidiary_search'
                                });

                                var subsidiarySearch = search.load({
                                    id: 'customsearchparent_subsidiary_search'
                                });
                                var searchSubsidiaryResults = subsidiarySearch.run();
                                var companyCodeSearch = searchSubsidiaryResults.getRange({
                                    start: 0,
                                    end: 1000
                                });
                                var internalId = '';

                                if (companyCodeSearch.length > 0) {
                                    for (i = 0; i < companyCodeSearch.length; i++) {
                                        if (companyCodeSearch[i].getValue(companyCodeSearch[i].columns[0]) == headerData[n]) {
                                            log.debug('found new one matched');
                                            var parent = {};
                                            internalId = companyCodeSearch[i].id;
                                            parent["id"] = companyCodeSearch[i].id;
                                            parent["name"] = companyCodeSearch[i].getValue(companyCodeSearch[i].columns[0]);
                                            parentArray.push(parent);
                                        }
                                    }
                                }
                                subsidiaryRec.setValue(fieldInternalId[n], internalId);
                            } else {
                                subsidiaryRec.setValue(fieldInternalId[n], parentInternalId);
                            }
                        } else if (fieldInternalId[n] == 'addressee' || fieldInternalId[n] == 'addr1' || fieldInternalId[n] == 'addr2' || fieldInternalId[n] == 'city' || fieldInternalId[n] == 'addrphone' || fieldInternalId[n] == 'zip' || (fieldInternalId[n] == 'state' && enteredSubrec == true)) {
                            if (fieldInternalId[n] == 'addressee') {
                                enteredSubrec = true;
                                subrec = subsidiaryRec.getSubrecord({
                                    fieldId: 'mainaddress'
                                });
                                subrec.setValue(fieldInternalId[n], headerData[n]);
                            } else if (fieldInternalId[n] == 'state' && enteredSubrec == true) {
                                subrec.setValue(fieldInternalId[n], shortname);
                            } else {
                                subrec.setValue(fieldInternalId[n], headerData[n]);
                            }
                        } else if (fieldInternalId[n] == 'country') {
                            var countryCode = getCountryCode(headerData[n]);
                            subsidiaryRec.setValue(fieldInternalId[n], countryCode);
                        } else if (fieldInternalId[n] == 'currency') {
                            for (i = 0; i < currencyArray.length; i++) {
                                if (currencyArray[i].name == headerData[n]) {
                                    subsidiaryRec.setValue(fieldInternalId[n], currencyArray[i].id);
                                }
                            }
                        } /////////////Naveen//////
                        else if (fieldInternalId[n] == 'fiscalcalendar' || fieldInternalId[n] == 'taxfiscalcalendar') {
                            subsidiaryRec.setText(fieldInternalId[n], headerData[n]);
                        } /////////////
                        else if (isNotNull(headerData[n])) {
                            log.debug('entered main row');
                            log.debug("subsidiaryRec",subsidiaryRec);
                            log.debug("fieldInternalId[n]",fieldInternalId[n]);
                            log.debug("isBoolean(headerData[n])",isBoolean(headerData[n]));
                            var subsidiaryRecValue = headerData[n];
                            if (fieldInternalId[n] == 'name') {
                                var subsidiaryName = subsidiaryRecValue;
                            }
                            subsidiaryRec.setValue(fieldInternalId[n], isBoolean(headerData[n]));
                        }

                    }
                    log.debug('subsidiaryRec', subsidiaryRec);
                    var parent = subsidiaryRec.getValue('parent');
                    if (isNotNull(parent)) {
                        subsidiaryRec.save();
                    } else {
                        var errorObj = error.create({
                            name: 'Parent Subsidiary Missing',
                            message: 'Parent Subsidiary is not found',
                            notifyOff: true
                        });
                        var errorString = "Error name :" + errorObj.name + " ,Error message :" + errorObj.message;
                        //context.write(subsidiaryName, errorString);
                        throw errorObj;
                    }

                }


            } catch (error) {
                log.debug('delete error', error);
                var errorString = error.message;
                errorCSVDetail = errorCSVDetail + errorString.replace(',', '') + ',';
                for (var errorloop = 0; errorloop < headerData.length; errorloop++) {
                    if (errorloop < headerData.length - 1)
                        errorCSVDetail = errorCSVDetail + headerData[errorloop] + ',';
                    else
                        errorCSVDetail = errorCSVDetail + headerData[errorloop] + '\n';
                }

                var string = errorCSVDetail;

                context.write(string);
            }

        }

        function isBoolean(rowdata) {
            if (rowdata.toLowerCase() == "true") {
                return true;
            } else if (rowdata.toLowerCase() == "false") {
                return false;
            } else {
                return rowdata;
            }
        }

        function isNotNull(rowData) {
            if (rowData == "" || null == rowData) {
                log.debug('rowdata', rowData);
                return false;
            } else {
                log.debug('rowdata has value', rowData);
                return true
            }
        }

        function getCountryCode(countryVal) {

            var countryCode = {
                "Andorra": "AD",
                "United Arab Emirates": "AE",
                "Afghanistan": "AF",
                "Antigua and Barbuda": "AG",
                "Anguilla": "AI",
                "Albania": "AL",
                "Armenia": "AM",
                "Angola": "AO",
                "Antarctica": "AQ",
                "Argentina": "AR",
                "American Samoa": "AS",
                "Austria": "AT",
                "Australia": "AU",
                "Aruba": "AW",
                "Aland Islands": "AX",
                "Azerbaijan": "AZ",
                "Bosnia and Herzegovina": "BA",
                "Barbados": "BB",
                "Bangladesh": "BD",
                "Belgium": "BE",
                "Burkina Faso": "BF",
                "Bulgaria": "BG",
                "Bahrain": "BH",
                "Burundi": "BI",
                "Benin": "BJ",
                "Saint Barthélemy": "BL",
                "Bermuda": "BM",
                "Brunei Darrussalam": "BN",
                "Bolivia": "BO",
                "Bonaire, Saint Eustatius, and Saba": "BQ",
                "Brazil": "BR",
                "Bahamas": "BS",
                "Bhutan": "BT",
                "Bouvet Island": "BV",
                "Botswana": "BW",
                "Belarus": "BY",
                "Belize": "BZ",
                "Canada": "CA",
                "Cocos (Keeling) Islands": "CC",
                "Congo, Democratic People's Republic": "CD",
                "Central African Republic": "CF",
                "Congo, Republic of": "CG",
                "Switzerland": "CH",
                "Cote d'Ivoire": "CI",
                "Cook Islands": "CK",
                "Chile": "CL",
                "Cameroon": "CM",
                "China": "CN",
                "Colombia": "CO",
                "Costa Rica": "CR",
                "Cuba": "CU",
                "Cape Verde": "CV",
                "Curacao": "CW",
                "Christmas Island": "CX",
                "Cyprus": "CY",
                "Czech Republic": "CZ",
                "Germany": "DE",
                "Djibouti": "DJ",
                "Denmark": "DK",
                "Dominica": "DM",
                "Dominican Republic": "DO",
                "Algeria": "DZ",
                "Ceuta and Melilla": "EA",
                "Ecuador": "EC",
                "Estonia": "EE",
                "Egypt": "EG",
                "Western Sahara": "EH",
                "Eritrea": "ER",
                "Spain": "ES",
                "Ethiopia": "ET",
                "Finland": "FI",
                "Fiji": "FJ",
                "Falkland Islands": "FK",
                "Micronesia, Federal State of": "FM",
                "Faroe Islands": "FO",
                "France": "FR",
                "Gabon": "GA",
                "United Kingdom": "GB",
                "Grenada": "GD",
                "Georgia": "GE",
                "French Guiana": "GF",
                "Guernsey": "GG",
                "Ghana": "GH",
                "Gibraltar": "GI",
                "Greenland": "GL",
                "Gambia": "GM",
                "Guinea": "GN",
                "Guadeloupe": "GP",
                "Equatorial Guinea": "GQ",
                "Greece": "GR",
                "South Georgia": "GS",
                "Guatemala": "GT",
                "Guam": "GU",
                "Guinea-Bissau": "GW",
                "Guyana": "GY",
                "Hong Kong": "HK",
                "Heard and McDonald Islands": "HM",
                "Honduras": "HN",
                "Croatia/Hrvatska": "HR",
                "Haiti": "HT",
                "Hungary": "HU",
                "Canary Islands": "IC",
                "Indonesia": "ID",
                "Ireland": "IE",
                "Israel": "IL",
                "Isle of Man": "IM",
                "India": "IN",
                "British Indian Ocean Territory": "IO",
                "Iraq": "IQ",
                "Iran (Islamic Republic of)": "IR",
                "Iceland": "IS",
                "Italy": "IT",
                "Jersey": "JE",
                "Jamaica": "JM",
                "Jordan": "JO",
                "Japan": "JP",
                "Kenya": "KE",
                "Kyrgyzstan": "KG",
                "Cambodia": "KH",
                "Kiribati": "KI",
                "Comoros": "KM",
                "Saint Kitts and Nevis": "KN",
                "Korea, Democratic People's Republic": "KP",
                "Korea, Republic of": "KR",
                "Kuwait": "KW",
                "Cayman Islands": "KY",
                "Kazakhstan": "KZ",
                "Lao People's Democratic Republic": "LA",
                "Lebanon": "LB",
                "Saint Lucia": "LC",
                "Liechtenstein": "LI",
                "Sri Lanka": "LK",
                "Liberia": "LR",
                "Lesotho": "LS",
                "Lithuania": "LT",
                "Luxembourg": "LU",
                "Latvia": "LV",
                "Libya": "LY",
                "Morocco": "MA",
                "Monaco": "MC",
                "Moldova, Republic of": "MD",
                "Montenegro": "ME",
                "Saint Martin": "MF",
                "Madagascar": "MG",
                "Marshall Islands": "MH",
                "Macedonia": "MK",
                "Mali": "ML",
                "Myanmar": "MM",
                "Mongolia": "MN",
                "Macau": "MO",
                "Northern Mariana Islands": "MP",
                "Martinique": "MQ",
                "Mauritania": "MR",
                "Montserrat": "MS",
                "Malta": "MT",
                "Mauritius": "MU",
                "Maldives": "MV",
                "Malawi": "MW",
                "Mexico": "MX",
                "Malaysia": "MY",
                "Mozambique": "MZ",
                "Namibia": "NA",
                "New Caledonia": "NC",
                "Niger": "NE",
                "Norfolk Island": "NF",
                "Nigeria": "NG",
                "Nicaragua": "NI",
                "Netherlands": "NL",
                "Norway": "NO",
                "Nepal": "NP",
                "Nauru": "NR",
                "Niue": "NU",
                "New Zealand": "NZ",
                "Oman": "OM",
                "Panama": "PA",
                "Peru": "PE",
                "French Polynesia": "PF",
                "Papua New Guinea": "PG",
                "Philippines": "PH",
                "Pakistan": "PK",
                "Poland": "PL",
                "St. Pierre and Miquelon": "PM",
                "Pitcairn Island": "PN",
                "Puerto Rico": "PR",
                "State of Palestine": "PS",
                "Portugal": "PT",
                "Palau": "PW",
                "Paraguay": "PY",
                "Qatar": "QA",
                "Reunion Island": "RE",
                "Romania": "RO",
                "Serbia": "RS",
                "Russian Federation": "RU",
                "Rwanda": "RW",
                "Saudi Arabia": "SA",
                "Solomon Islands": "SB",
                "Seychelles": "SC",
                "Sudan": "SD",
                "Sweden": "SE",
                "Singapore": "SG",
                "Saint Helena": "SH",
                "Slovenia": "SI",
                "Svalbard and Jan Mayen Islands": "SJ",
                "Slovak Republic": "SK",
                "Sierra Leone": "SL",
                "San Marino": "SM",
                "Senegal": "SN",
                "Somalia": "SO",
                "Surinam": "SR",
                "South Sudan": "SS",
                "Sao Tome and Principe": "ST",
                "El Salvador": "SV",
                "Sint Maarten": "SX",
                "Syrian Arab Republic": "SY",
                "Swaziland": "SZ",
                "Turks and Caicos Islands": "TC",
                "Chad": "TD",
                "French Southern Territories": "TF",
                "Togo": "TG",
                "Thailand": "TH",
                "Tajikistan": "TJ",
                "Tokelau": "TK",
                "Turkmenistan": "TM",
                "Tunisia": "TN",
                "Tonga": "TO",
                "East Timor": "TP",
                "Turkey": "TR",
                "Trinidad and Tobago": "TT",
                "Tuvalu": "TV",
                "Taiwan": "TW",
                "Tanzania": "TZ",
                "Ukraine": "UA",
                "Uganda": "UG",
                "US Minor Outlying Islands": "UM",
                "United States": "US",
                "Uruguay": "UY",
                "Uzbekistan": "UZ",
                "Holy See (City Vatican State)": "VA",
                "Saint Vincent and the Grenadines": "VC",
                "Venezuela": "VE",
                "Virgin Islands (British)": "VG",
                "Virgin Islands (USA)": "VI",
                "Vietnam": "VN",
                "Vanuatu": "VU",
                "Wallis and Futuna Islands": "WF",
                "Samoa": "WS",
                "Kosovo": "XK",
                "Yemen": "YE",
                "Mayotte": "YT",
                "South Africa": "ZA",
                "Zambia": "ZM",
                "Zimbabwe": "ZW"
            }
            var countryKey = countryCode[countryVal];
            return countryKey;
        }

        function reduce(context) {
            log.debug('context.key', context.key);
            log.debug('context.value', context.value);
            context.write(context.key, context.values);
        }

        function summarize(summary) {
            var scriptErrorparamId = runtime.getCurrentScript().getParameter("custscript_errorlogs_folderid");
            var scriptAdminparamId = runtime.getCurrentScript().getParameter("custscript_system_admin");
            var type = summary.toString();

            log.audit(type + ' Usage Consumed', summary.usage);
            log.audit(type + ' Concurrency Number ', summary.concurrency);
            log.audit(type + ' Number of Yields', summary.yields);
            var contents = '';
            summary.output.iterator().each(function(key, value) {
                contents += key;
                log.debug('Summ Comtetnts', contents);
                return true;
            });
            if (contents && contents != '' && contents != null) {
                var fileObj = file.create({
                    name: 'SUBSIDIARY ERROR LOGS',
                    fileType: file.Type.CSV,
                    contents: contents
                });
                fileObj.folder = scriptErrorparamId;
                var errorFileId = fileObj.save();
                var fileObj = file.load({
                    id: errorFileId
                });

                var erroremail = email.send({
                    author: scriptAdminparamId,
                    recipients: runtime.getCurrentUser().id,
                    subject: "Netsuite Subsidiary Import Confirmation",
                    body: "Thank You For using NetSuite Subsidiary Import Assistance.Please find the attached sheet for the error logs.",
                    attachments: [fileObj]
                });
                log.debug('Error Email', erroremail);
            } else {
                email.send({
                    author: scriptAdminparamId,
                    recipients: runtime.getCurrentUser().id,
                    subject: "Netsuite Subsidiary Import Confirmation",
                    body: "Thank You For using NetSuite Subsidiary Import Assistance.All your records had been successfully created.",
                });
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });