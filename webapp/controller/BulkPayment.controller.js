sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"../model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageStrip",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"../util/Constants",
	'sap/ui/export/Spreadsheet'
], function (BaseController, JSONModel, formatter, Filter, FilterOperator, MessageStrip, MessageBox, MessageToast, Constants,
	Spreadsheet) {
	"use strict";

	return BaseController.extend("com.ee.BulkPayment.controller.BulkPayment", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the main controller is instantiated.
		 * @public
		 */
		onInit: function () {
			BaseController.prototype.onInit.call(this);
			this._oPage = this.byId(Constants.UploadPageID);
			this._oPage.setBusyIndicatorDelay(1);

			this._oHeldUploadDocSmartTable = this.byId(Constants.UploadPageHeldDocSmartTableID);
			this._oGridTable = this._oHeldUploadDocSmartTable.getTable();

			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());

			// Model used to manipulate control states
			var oViewModel = new JSONModel({
				binaryFile: ""
			});
			this.setModel(oViewModel, "mainView");
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/** 
		 * Event is fired when the file is selected from the browse.
		 * @param {object} oEvent The propagated event object.
		 * @public
		 */
		onChangeFileUploader: function (oEvent) {
			//This event fired when user select a file to upload.
			this._addTokenToUploader(oEvent);
			var oFileUploader = this.byId(Constants.FileUploaderID);
			if (oFileUploader.getValue()) {
				this._hideMessageStrip();
				oFileUploader.upload();
				this._oPage.setBusy(true);
				this.byId("idUploadSmartTable").getTable().unbindRows();
			}
		},

		/** 
		 * Event is fired when submit button is pressed.
		 * @param {object} oEvent The propagated event object.
		 * @public
		 */
		onPressSubmit: function (oEvent) {
			var oModel = this.getView().getModel(),
				oUrlParams = {
					BatchID: this._sBatchID,
					LineItem: 1
				};

			oModel.callFunction("/create_bulk_payment", {
				method: "POST",
				urlParameters: oUrlParams,
				success: function (oData) {
					this._insertMessageStrip(this.getResourceBundle().getText("createUpdateGuidedDesignSuccessMessage"), "Success");
					this._oHeldUploadDocSmartTable.rebindTable();
				}.bind(this),
				error: function (oError) {
					var oErrorResponse = JSON.parse(oError.responseText),
						oErrorMessage = "";

					var aErrorDetails = oErrorResponse.error.innererror.errordetails;
					for (var i = 0; i < aErrorDetails.length; i++) {
						oErrorMessage += aErrorDetails[i].message + "\n";
					}
					MessageBox.error(oErrorMessage);
				}.bind(this)
			});
		},

		/** 
		 * Event is fired when cancel button is pressed.
		 * @public
		 */
		onPressCancel: function () {
			var sCancelTitle = this.getResourceBundle().getText("cancelTitle"),
				sConfirmationMessage = this.getResourceBundle().getText("cancelMessage");

			MessageBox.warning(sConfirmationMessage, {
				title: sCancelTitle,
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function (sAction) {
					if (sAction === MessageBox.Action.OK) {
						this.getModel().resetChanges();
						this.getModel().refresh();
						window.history.go(-1);
					}
				}.bind(this)
			});

		},

		/** 
		 * Event is fired when download template button is pressed.
		 * @public
		 */
		onPressDownloadTemplate: function () {
			var oSettings, oSheet;
			var aCols = [{
				property: 'HE',
				label: 'HE'
			}, {
				property: 'CompCode',
				label: 'Comp.Code'
			}, {
				property: 'SupplierName',
				label: 'Supplier.Name'
			}, {
				property: 'SupplierNumber',
				label: 'Supplier.Number'
			}, {
				property: 'ABNNumber',
				label: 'ABN.Number'
			}, {
				property: 'PaymentRefNumber',
				label: 'Payment.Ref.Number'
			}, {
				property: 'DocumentDate',
				label: 'Document.Date'
			}, {
				property: 'DueDate',
				label: 'Due.Date'
			}, {
				property: 'GrossAmount',
				label: 'Gross.Amount'
			}, {
				property: 'TotalTaxAmount',
				label: 'Total.Tax.Amount'
			}, {
				property: 'ReqEmailID',
				label: 'Req.Email.ID'
			}];

			var oViewModel =
				new JSONModel(
					[{
						HE: "GL",
						CompCode: "Description",
						SupplierName: "Line.Amount",
						SupplierNumber: "Debit.Credit",
						ABNNumber: "Tax.Code",
						PaymentRefNumber: "Line.Tax.Amount",
						DocumentDate: "GL.Account",
						DueDate: "Cost.Center",
						GrossAmount: "Profit.Center",
						TotalTaxAmount: "WBS.Element",
						ReqEmailID: ""
					}, {
						HE: "END"
					}]);
			this.getView().setModel(oViewModel, "dataSource");

			oSettings = {
				workbook: {
					columns: aCols
				},
				dataSource: this.getModel("dataSource").getData(),
				fileName: 'Bulk Payment.xlsx'
			};

			oSheet = new Spreadsheet(oSettings);
			oSheet.build()
				.then(function () {
					MessageToast.show(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("templateDownloadedMessage"));
				}.bind(this))
				.finally(oSheet.destroy);
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/*
		 * Handler to set the file status.
		 * @param {string} sValue hold the status text.
		 * @public
		 */
		_formatRowHighlight: function (sValue) {
			if (sValue === "Failed") {
				return "Error";
			}
			return sValue;
		},

		/*
		 * Handler to validate the file content.
		 * @param {object} oEvent The propagated event object.
		 * @private
		 */
		_addTokenToUploader: function (oEvent) {
			//Add header parameters to file uploader.
			var oDataModel = this.getOwnerComponent().getModel(),
				sTokenForUpload = oDataModel.getSecurityToken(),
				oFileUploader = this.byId(Constants.FileUploaderID),
				oHeaderParameter = new sap.ui.unified.FileUploaderParameter({
					name: "X-CSRF-Token",
					value: sTokenForUpload
				});

			//Header parameter need to be removed then added.
			oFileUploader.removeAllHeaderParameters();
			oFileUploader.addHeaderParameter(oHeaderParameter);

			var reader = new FileReader(),
				oFile = oEvent.getParameters()["files"][0];

			reader.onload = function (e) {

				var data = e.target.result,
					sBase64 = btoa(data);

				this.getModel("mainView").setProperty("/binaryFile", sBase64);

				var oProperties = {
					BatchID: "000D3AD140131EEB8EF20DEE0FE1017F",
					LineItem: 1,
					FileContent: this.getModel("mainView").getProperty("/binaryFile"),
					DocumentNumber: "",
					DocumentDate: null,
					CompanyCode: "",
					PaymentRefNum: "",
					GrossAmount: "0.00",
					CurrencyUnit: "",
					RequesterID: "",
					Status: "",
					ErrorMessage: ""
				};

				this.getModel().create("/ZQ_FIN_VIMBulkPayment", oProperties, {
					success: function (oData, response) {
						this._hideMessageStrip();
						var oMessage = response.headers["sap-message"];
						if (oMessage) {
							var oMessageObject = JSON.parse(oMessage);
							this._sBatchID = oMessageObject.message;
						}
						this.getModel().read("/ZQ_FIN_VIMBulkPayment_Read");
						this._oHeldUploadDocSmartTable.rebindTable();
						this._oPage.setBusy(false);

					}.bind(this),
					error: function (oError) {

						if (oError.statusCode !== 500 || oError.statusCode !== 504) {
							var oErrorResponse = JSON.parse(oError.responseText);
							this.getOwnerComponent().preventDefaultErrorHandler();
							this._oPage.setBusy(false);
							this._insertMessageStrip(oErrorResponse.error.message.value, "Error");
						}

					}.bind(this)
				});
			}.bind(this);
			reader.readAsBinaryString(oFile);
		},

		/*
		 * Handler to display message strip.
		 * @param {string} sText hold the status text.
		 * @param {string} sType hold the status type.
		 * @private
		 */
		_insertMessageStrip: function (sText, sType) {
			var oMessageStripVbox = this.byId("MessageStripVbox"),
				oMessageStrip = sap.ui.getCore().byId("msgStrip");
			oMessageStripVbox.setVisible(true);

			if (oMessageStrip) {
				oMessageStrip.setText(sText);
				oMessageStrip.setType(sType);
				oMessageStrip.setVisible(true);
			} else {
				oMessageStrip = new MessageStrip("msgStrip", {
					showCloseButton: true,
					showIcon: true,
					text: sText,
					type: sType
				});
				oMessageStripVbox.addItem(oMessageStrip);
			}
		},

		/*
		 * Handler to hide message strip.
		 * @private
		 */
		_hideMessageStrip: function () {
			var oMessageStripVbox = this.byId("MessageStripVbox");
			oMessageStripVbox.setVisible(false);

		},

		/*
		 * Handler to generate random UUID.
		 * @private
		 */
		_getUUID: function () {
			var uuid = "",
				i, random;

			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += "-";
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random))
					.toString(16);
			}
			return uuid;
		}

	});
});