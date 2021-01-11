describe("do nothing", () => {
  it("di nothing.. in progress", () => {});
});

// import { PackageXMLManifestHelpers } from "../../src/manifest/PackageXMLManifestHelpers";

// describe("Given a Package XML of the components to be deployed", () => {
//   let xmlManifestWithApexandProfiles = {
//     Package: {
//       $: {
//         xmlns: "http://soap.sforce.com/2006/04/metadata",
//       },
//       types: [
//           {
//           name: "AuraDefinitionBundle",
//           members: [
//             "Articles",
//             "ProgressIndicator",
//             "RecordHunterEvent",
//             "RecordHunter_DataTable",
//             "RecordHunter_MultiSelect",
//             "RecordHunter_SearchBox",
//             "ScreenFlowButtons",
//             "TSBulkUploadAura",
//             "VM_Send_Invite_Lst_Calvax",
//           ],
//         },
//         {
//           name: "ApexClass",
//           members: [
//             "AccountTriggerHandler",
//             "AccountTriggerHandlerTest",
//             "Data_TableV2_Controller",
//             "Generate_Dose_Admin_Pdf",
//             "Generate_Dose_Admin_PdfTest",
//             "Generate_QR_Code",
//             "RecordHunterController",
//             "RecordHunterController_Test",
//             "RecordHunterField",
//             "RecordHunterLexer",
//             "SObjectController2",
//             "SObjectController2Test",
//             "Send_Receipt",
//             "Send_Receipt_Test",
//             "TestDataFactory",
//             "TestFileRestriction",
//             "appoinmentSchedulerControllerTest",
//           ],
//         },
//         {
//           name: "EmailTemplate",
//           members: "unfiled$public/Send_Receipt_1608285396801",
//         },
//         {
//           name: "FlexiPage",
//           members: [
//             "Account_Record_Page_AR",
//             "Client_Search"
//           ],
//         },
//         {
//           name: "Flow",
//           members: [
//             "Administer_Dose",
//             "Asset_Creator",
//             "Bulk_Create_Excursion_Event"
//           ],
//         },
//         {
//           name: "GlobalValueSet",
//           members: ["Language", "Languages"],
//         },
//         {
//           name: "CustomLabels",
//           members: "CustomLabels",
//         },
//         {
//           name: "CustomLabel",
//           members: "*",
//         },
//         {
//           name: "Layout",
//           members: [
//             "Account-Site %28Service Delivery Location%29",
//             "Appointment__c-Appointment Layout",
//             "Appointment__c-Patient Community Appointment Layout"
//           ],
//         },
//         {
//         name:"Profile",
//         members:[
//           "Admin",
//           "Admin2"
//         ]
//         },
//         {
//           name: "MatchingRules",
//           members: "PersonAccount"
//         }
//       ],
//       version: "50.0",
//     },
//   };

//   let xmlManifestWithoutApexNorProfiles = {
//     Package: {
//       $: {
//         xmlns: "http://soap.sforce.com/2006/04/metadata",
//       },
//       types: [
//           {
//           name: "AuraDefinitionBundle",
//           members: [
//             "Articles",
//             "ProgressIndicator",
//             "RecordHunterEvent",
//             "RecordHunter_DataTable",
//             "RecordHunter_MultiSelect",
//             "RecordHunter_SearchBox",
//             "ScreenFlowButtons",
//             "TSBulkUploadAura",
//             "VM_Send_Invite_Lst_Calvax",
//           ],
//         },
//         {
//           name: "EmailTemplate",
//           members: "unfiled$public/Send_Receipt_1608285396801",
//         },
//         {
//           name: "FlexiPage",
//           members: [
//             "Account_Record_Page_AR",
//             "Client_Search"
//           ],
//         },
//         {
//           name: "Flow",
//           members: [
//             "Administer_Dose",
//             "Asset_Creator",
//             "Bulk_Create_Excursion_Event"
//           ],
//         },
//         {
//           name: "GlobalValueSet",
//           members: ["Language", "Languages"],
//         },
//         {
//           name: "CustomLabels",
//           members: "CustomLabels",
//         },
//         {
//           name: "CustomLabel",
//           members: "*",
//         },
//         {
//           name: "Layout",
//           members: [
//             "Account-Site %28Service Delivery Location%29",
//             "Appointment__c-Appointment Layout",
//             "Appointment__c-Patient Community Appointment Layout"
//           ],
//         },
//         {
//           name: "MatchingRules",
//           members: "PersonAccount"
//         }
//       ],
//       version: "50.0",
//     },
//   };
//    it("If apex clas or triggers exist, return true",()=>{
//      expect(PackageXMLManifestHelpers.checkApexInPayload(xmlManifestWithApexandProfiles)).toBe(true);
//    });

//    it("If apex clas or triggers exist, return false",()=>{
//     expect(PackageXMLManifestHelpers.checkApexInPayload(xmlManifestWithoutApexNorProfiles)).toBe(false);
//   });

//   it("If profiles exist, return true",()=>{
//     expect(PackageXMLManifestHelpers.checkProfilesinPayload(xmlManifestWithApexandProfiles)).toBe(true);
//   });

//   it("If profiles exist, return true",()=>{
//     expect(PackageXMLManifestHelpers.checkProfilesinPayload(xmlManifestWithoutApexNorProfiles)).toBe(false);
//   });

// });
