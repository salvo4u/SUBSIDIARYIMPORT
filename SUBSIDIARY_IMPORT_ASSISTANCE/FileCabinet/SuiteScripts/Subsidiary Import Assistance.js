/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/email', 'N/runtime', 'N/record', 'N/file','N/redirect','N/task','N/url'],
    function(serverWidget,email, runtime,record,file,redirect,task,url) {
        function onRequest(context) {
			try{
            if (context.request.method === 'GET') {
                var form = serverWidget.createForm({
                    title: 'Subsidiary Import Assistance'
                });
				var scriptparamId = runtime.getCurrentScript().getParameter("custscript_upload_document_folder");
				log.debug('scriptparamId',scriptparamId);
				var downloadTemp = context.request.parameters.isTemplateDownload;
				
				var upload = context.request.parameters.isUpload;
				log.debug('upload',upload);
				var flag = context.request.parameters.testflag;
				log.debug('flag',flag);
                var subsidiary_rec = record.create({
                    type: record.Type.SUBSIDIARY,
                    isDynamic: true,
                });
				
				var recordObj = record.create({
                    type: 'customrecord_subsidiary_codes',
                    isDynamic: true,
                });
				var outputDomain = url.resolveDomain({
						hostType: url.HostType.APPLICATION
						
					});
					log.debug('outputDomain',outputDomain);
                var recordFields = subsidiary_rec.getFields();
                var recordFieldIds = [];
                var recordFieldLabels = [];
				/////////////////Creation Of Field InternalIds////////////////
                var JSONobj = '{"Name":"name","Subsubsidiary of":"parent",';
                for (var i = 0; i < recordFields.length; i++) {

                    var field = subsidiary_rec.getField(recordFields[i]);
                    
                    if (field && field.label) {
                        recordFieldLabel = field.label;
						recordFieldLabel = recordFieldLabel.replace(',' ,'');
                        recordFieldId = field.id;
						
                        if(recordFieldLabel!= 'Name' && recordFieldLabel!= 'Subsubsidiary of' && recordFieldLabel!= 'ExternalId' &&recordFieldLabel!= 'Internal ID')
						{
							if(i<recordFields.length-1)
						JSONobj = JSONobj+JSON.stringify(recordFieldLabel)+":"+JSON.stringify(recordFieldId)+",";
					         //else
						//JSONobj = JSONobj+JSON.stringify(recordFieldLabel)+":"+JSON.stringify(recordFieldId);
                        recordFieldIds.push(recordFieldId);
                        recordFieldLabels.push(recordFieldLabel);
						}
                    }
                }
JSONobj = JSONobj+'"ATTENTION":"attention","ADDRESSEE":"addressee","PHONE":"addrphone","ADDRESS 1":"addr1","ADDRESS 2":"addr2","CITY":"city","STATE":"state","ZIP":"zip"';
				JSONobj = JSONobj+'}';
				var fileObjInternalIds = file.create({
                        name: "Subsidiary Internal Ids",
                        fileType: file.Type.PLAINTEXT,
                        contents: JSONobj,
                        folder: scriptparamId
                    });
					 var fileSave_JSON = fileObjInternalIds.save();
				/////////////////////////////////////////////////////////////////////
     				var countryField = recordObj.getField('custrecord150');
					var countryOptions = countryField.getSelectOptions();
					var JSONString = '{';
					for(var k=0;k<countryOptions.length;k++) {
					   var id = countryOptions[k].value;
					   var text = countryOptions[k].text;
					   if(k == countryOptions.length-1)
					JSONString = JSONString+JSON.stringify(text)+':'+ JSON.stringify(id);
					else
					JSONString = JSONString+JSON.stringify(text)+':'+ JSON.stringify(id)+',';	
					}
                   JSONString = JSONString+'}';
				   var stateIdJson = file.create({
                        name: "State internalIds",
                        fileType: file.Type.PLAINTEXT,
                        contents: JSONString,
                        folder: scriptparamId
                    });
			   var stateSave_JSON = stateIdJson.save();
			   log.debug('StateCodes',stateSave_JSON);
                var finalTemplate = "";
				finalTemplate = finalTemplate + "Name,Subsubsidiary of,";
				finalTemplate = finalTemplate + recordFieldLabels.toString();
				finalTemplate = finalTemplate + 'ATTENTION,ADDRESSEE,PHONE,ADDRESS 1,ADDRESS 2,CITY,STATE,ZIP';
                log.debug('finalTemplate',finalTemplate);
				 
				

                var fileObj = file.create({
                    name: 'DefaultTemplate.csv',
                    fileType: file.Type.PLAINTEXT,
                    contents: finalTemplate,
                    folder: scriptparamId
                });
			    var fileId = fileObj.save();
				var fileloderObj = file.load({
								id: fileId
							});
				var fileUrl = fileloderObj.url;
				fileUrl = fileUrl+'&_xd=T'
				log.debug('fileUrl',fileUrl);
				form.addSubmitButton({
									label : 'Upload'
								}); 
				
					if(flag!=1)
					{
					
					//var Suitelet_url = "https://system.netsuite.com/core/media/media.nl?id="+fileId+"&c=TSTDRV1151650&h=33b0b9c910552cc7aaff&_xd=T&_xt=.csv"
					var Suitelet_url = fileUrl;
					log.debug('Suitelet_url',Suitelet_url);

			            var window_new_open= 'window.open(\''+Suitelet_url+'\',\'_blank\', \'\')';		
						form.addButton({
							id : '_downloadlink',
							label : 'Download',
							functionName: window_new_open
						});
						
					}
					else if(flag == 1 && upload =='T')
					{
				    var fileUploads = form.addField({
                    id: '_upload_file',
                    type: serverWidget.FieldType.FILE,
                    label: 'Select File To Upload',
                   });
				     
					}
					
					if(flag!=1)
					{
					
					var instructstring = '';
					instructstring+= '<html>';
					instructstring+= '<body>';
					instructstring+= '<p>&nbsp;</p>';
					instructstring+= '<p>&nbsp;</p>';
					instructstring+= '<p>&nbsp;</p>';
					instructstring+= '<p>&nbsp;</p>';
					instructstring+= '<p>&nbsp;</p>';
					instructstring+= '<h1 style="font-size:200%;"><u>Please read the below instructions carefully</u></h1>';
					instructstring+= '<p style="font-size:130%;">1.Download te sample CSV templete by clicking the download buttton.</p>';
					instructstring+= '<p style="font-size:130%;">2.Please fillin the data in the file downloaded.</p>';
					instructstring+= '<p style="font-size:130%;">3.Ensure to give "true" or "false" for the checkbox fields.</p>';
					instructstring+= '<p style="font-size:130%;">4.Ensure to give the parent-child relationship properly.</p>';
					instructstring+= '<p style="font-size:130%;">5.click on "Upload" Button to upload the CSV file into NetSuite. </p>';
					instructstring+= '<p style="font-size:130%;">6.Please choose the CSV file with proper data and then click on upload again. </p>';
					instructstring+= '</body>';
					instructstring+= '</html>';
					var defaultMessage = form.addField({
							id : 'custpage_default_message',
							type : serverWidget.FieldType.INLINEHTML,
							label : 'Note:'
								}).defaultValue = instructstring;
					}
				//defaultMessage.layoutType = serverWidget.FieldLayoutType.MIDROW;
				context.response.writePage(form);
					
					
                	
					} else {
                var isTemplateDownload = context.request.parameters.download;
                var fileUploadData = context.request.files._upload_file;
                if (fileUploadData) {
                    fileUploadData = fileUploadData.getContents();
                    log.debug('fileUploadData', fileUploadData);
                    //creating the file in filecabinet of the file that the opertaion is performed on
					var date = new Date();
                var currentdate = date.getDate();
                var month = date.getMonth();
                var year = date.getYear();

                var hours = date.getHours();
                var minutes = date.getMinutes();
                var seconds = date.getSeconds();
                var milliSec = date.getMilliseconds();
                date = date.toString();
					var fileName = 'SUB_' + currentdate + month + year + 'T' + hours + minutes + seconds + milliSec;
                    var fileObj = file.create({
                        name: fileName,
                        fileType: file.Type.CSV,
                        contents: fileUploadData,
                        folder: 3124
                    });
                    var fileSave = fileObj.save();
                    log.debug('fileSave', fileSave);
					var delete_task = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_ns_mr_subsidiary_import',
                            deploymentId: 'customdeploy_subsidiary_import',
                            params: {
                                custscript_new_file_data: fileSave,
								custscript_subsidiary_internalid_fileid: fileSave_JSON,
								custscript_state_internalid_fileid:stateSave_JSON

                            }
                        });
                        var mrTaskId = delete_task.submit();
						var form = serverWidget.createForm({
                        title: ' '
                    });
                    var uploadConfirmation = serverWidget.createForm({
                        title: 'Your Request has been received. Tool will import the subsidiaryies shortly. ThankYou!'
                    });
                    context.response.writePage(uploadConfirmation);
                    

                }
				else
				{
				redirect.toSuitelet({
                      scriptId: 'customscript_subsidiary_import_assist',
                      deploymentId: 'customdeploy1',
                      parameters: {
                          'isTemplateDownload': isTemplateDownload,
                          'isUpload': 'T',
						  'testflag':1
                          }
                  })
					}
			}
                
        }
		catch(e)
		{
			log.debug('error',e);
		}
	}
        return {
            onRequest:onRequest
        };
    });