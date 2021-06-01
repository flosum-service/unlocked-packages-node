const AdmZip = require('adm-zip');
const fs = require('fs');
const constants = require('../../../constants');
const path = require('path');

class MetadataTypeParser {
  count;
  chunkCounter;
  componentList;
  zip;
  size;
  functionMap;
  packageTypeList;
  chunkList;
  projectPath;
  packageName;
  log;
  componentTypeListWithMetaXML;

  constructor(packageTypeList, projectPath, packageName, log) {
    this.projectPath = projectPath;
    this.packageName = packageName;
    this.packageTypeList = packageTypeList;
    this.log = log;
    this.zip = new AdmZip();
    this.count = 0;
    this.chunkCounter = 0;
    this.componentList = [];
    this.size = 0;
    this.chunkList = [{ typeList: [] }];

    this.componentTypeListWithMetaXML = [
      'ApexClass',
      'ApexComponent',
      'ApexPage',
      'ApexTrigger',
      'StaticResource',
      'Document'
    ];

    this.customObjectChildMap = {
      'CustomField': 'fields',
      'ListView': 'listViews',
      'RecordType': 'recordTypes',
      'ValidationRule': 'validationRules',
      'WebLink': 'webLinks',
      'CompactLayout': 'compactLayouts',
      'BusinessProcess': 'businessProcesses',
    };

    this.functionMap = {
      ApexClass: this.getDefaultTypes,
      ApexComponent: this.getDefaultTypes,
      ApexPage: this.getDefaultTypes,
      ApexTrigger: this.getDefaultTypes,
      AppMenu: this.getDefaultTypes,
      AuraDefinitionBundle: this.getDefaultTypes,
      CustomObject: this.getDefaultTypes,
      CustomPermission: this.getDefaultTypes,
      CustomTab: this.getDefaultTypes,
      FlexiPage: this.getDefaultTypes,
      Flow: this.getDefaultTypes,
      FlowDefinition: this.getDefaultTypes,
      GlobalValueSet: this.getDefaultTypes,
      HomePageLayout: this.getDefaultTypes,
      IframeWhiteListUrlSettings: this.getDefaultTypes,
      Layout: this.getDefaultTypes,
      LightningComponentBundle: this.getDefaultTypes,
      NamedCredential: this.getDefaultTypes,
      PermissionSet: this.getDefaultTypes,
      RemoteSiteSetting: this.getDefaultTypes,
      ReportType: this.getDefaultTypes,
      StaticResource: this.getDefaultTypes,
      BrandingSet: this.getDefaultTypes,

      ContentAsset: this.getDefaultTypes,
      CustomMetadata: this.getDefaultTypes,
      Group: this.getDefaultTypes,
      LightningExperienceTheme: this.getDefaultTypes,
      CustomNotificationType: this.getDefaultTypes,
      CustomObjectTranslation: this.getDefaultTypes,
      PathAssistant: this.getDefaultTypes,
      Queue: this.getDefaultTypes,
      QuickAction: this.getDefaultTypes,
      Role: this.getDefaultTypes,
      Settings: this.getDefaultTypes,
      StandardValueSet: this.getDefaultTypes,
      ApexTestSuite: this.getDefaultTypes,
      Workflow: this.getDefaultTypes,

      CustomField: this.getChildTypesFromCustomObject,
      ListView: this.getChildTypesFromCustomObject,
      RecordType: this.getRecordTypes,
      ValidationRule: this.getChildTypesFromCustomObject,
      WebLink: this.getChildTypesFromCustomObject,
      CompactLayout: this.getChildTypesFromCustomObject,
      BusinessProcess: this.getChildTypesFromCustomObject,
      // FieldSet: this.getChildTypesFromCustomObject,

      Document: this.getTypesFromFolder,
      EmailTemplate: this.getTypesFromFolder,
      Report: this.getTypesFromFolder
    }
  }

  parseMetadata() {
    this.packageTypeList.forEach((type) => {
      const folderType = constants.METADATA_FOLDER_TYPE_MAP[type.type];
      const folderTypePath = `${this.projectPath}/${this.packageName}/${folderType}`;
      if (folderType && fs.existsSync(folderTypePath)) {
        const folderContentList = fs.readdirSync(folderTypePath, { withFileTypes: true });
        if (this.functionMap[type.type]) {
          this.functionMap[type.type].call(this, type, folderContentList, folderType);
        } else {
          this.log.log(`Unsupported Component Type ${type.type}. Handler Not Found.`);
        }
      } else {
        this.log.log(`Unsupported Component Type ${type.type}. Folder Not Found.`);
      }

      const zipBuffer = this.zip.toBuffer().toString('base64');
      if (zipBuffer !== 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==') {
        this.chunkList[this.chunkCounter].typeList.push({ componentList: this.componentList, type: type.type, zip: zipBuffer });
        this.log.log(`Component Type: ${type.type}, count: ${this.count}`);
      }
      this.zip = new AdmZip();
      this.componentList = [];
      this.count = 0;
    });

    return this.chunkList;
  }

  //Document, EmailTemplate, Report
  getTypesFromFolder(type, folderContentList, folderType) {
    const typePath = `${this.projectPath}/${this.packageName}/${folderType}`;
    type.componentList.forEach((component) => {
      const componentPathList = component.apiName.split('/');
      const componentFolder = componentPathList[0];
      const componentFile = componentPathList[1];
      const componentFolderPath = `${typePath}/${componentFolder}`
      if (fs.existsSync(componentFolderPath)) {
        const folderComponentContentList = fs.readdirSync(componentFolderPath, { withFileTypes: true });
        folderComponentContentList.forEach((content) => {
          if (`${componentFolder}/${content.name}`.includes(`${componentFile}.`)) {
            this.size += fs.statSync(`${componentFolderPath}/${content.name}`).size;
            this.zip.addLocalFile(`${componentFolderPath}/${content.name}`, `${folderType}/${componentFolder}`);
            if (!content.name.includes('-meta.xml')) {
              component.label = `${folderType}/${componentFolder}/${content.name}`;
              if (type.type === 'Document') {
                component.apiName = `${componentFolder}/${content.name}`;
              }
              component.folder = componentFolder;
              this.componentList.push(component);
              this.count++;
              this.updateChunkList(type);
            }
          }
        });
      }
      delete component.isDirectory;
      delete component.fileList;
    });
  }

  // ApexClass, ApexComponent, ApexPage, ApexTrigger, AppMenu, AuraDefinitionBundle,
  // CustomObjects, CustomPermission, CustomTab, FlexiPage, Flow, FlowDefinition, GlobalValueSet,
  // HomePageLayout, IframeWhiteListUrlSettings, Layout, LightningComponentBundle, NamedCredential,
  // PermissionSet, RemoteSiteSetting, ReportType, Workflow, ApexTestSuite, StandardValueSet, Settings,
  // Role, QuickAction, Queue, PathAssistant, CustomObjectTranslation, CustomNotificationType,
  // LightningExperienceTheme, Group, CustomMetadata, ContentAsset
  getDefaultTypes(type, folderContentList, folderType){
    const typePath = `${this.projectPath}/${this.packageName}/${folderType}`;
    type.componentList.forEach((component) => {
      folderContentList.forEach((content) => {
        const objectExtend = path.parse(content.name)
        if (objectExtend.name === component.apiName
          || (objectExtend.ext === '.xml' && objectExtend.name.includes(component.apiName + '.'))
        ) {
          component.fileList.push(content.name);
          component.isDirectory = content.isDirectory();
          if (!content.name.includes('-meta.xml')) {
            component.label = `${folderType}/${content.name}`;
          }
        }
      });
    });

    type.componentList.forEach((component) => {
      this.componentList.push(component);
      this.count++;
      component.fileList.forEach((file) => {
        this.size += fs.statSync(`${typePath}/${file}`).size;
        if (component.isDirectory) {
          this.zip.addLocalFolder(`${typePath}/${file}`, `${folderType}/${file}`);
        } else {
          this.zip.addLocalFile(`${typePath}/${file}`, folderType);
        }
      });
      this.updateChunkList(type);
      delete component.isDirectory;
      delete component.fileList;
    });

  }

  // CustomField, ListView, ValidationRule, WebLink
  getChildTypesFromCustomObject(type, folderContentList, folderType) {
    if (type.type === 'CustomField') {
      console.log('e')
    }
    if (!this.customObjectChildMap[type.type]) {
      this.log.log(`Unsupported Component Type ${type.type}. Child Type Not Found.`);
      return
    }
    const typePath = `${this.projectPath}/${this.packageName}/${folderType}`;
    const prepareObjectMap = {};
    folderContentList.forEach((content) => {
      type.componentList.forEach((component) => {
        if (component.apiName.split('.')[0] === path.parse(content.name).name) {
          if (!prepareObjectMap[content.name]) {
            prepareObjectMap[content.name] = { name : content.name, componentList: [component] }
          } else {
            prepareObjectMap[content.name].componentList.push(component);
          }
          component.label = `${folderType}/${content.name}`;
          type.fileName = content.name;
        }
      });
    });

    const customObjectList = [];
    Object.keys(prepareObjectMap).forEach((key) => {
      const content = prepareObjectMap[key];
      customObjectList.push({
        file: fs.readFileSync(`${typePath}/${content.name}`, 'utf8'),
        fileName: content.name,
        componentList: content.componentList
      });
    });

    const customFieldList = this.convertToChildType(customObjectList, this.customObjectChildMap[type.type]);
    customFieldList.forEach((customField) => {
      this.size += customField.file.length;
      this.zip.addFile(`objects/${customField.fileName}`, Buffer.from(customField.file, 'utf-8'), '');
      this.componentList.push(...customField.componentList);
      this.count += customField.componentList.length;
      this.updateChunkList(type);
    });
    type.zip = this.zip.toBuffer().toString('base64');
  }

  getRecordTypes(type, folderContentList, folderType) {
    const typePath = `${this.projectPath}/${this.packageName}/${folderType}`;
    const antiDuplicateFieldSet = new Set();
    folderContentList.forEach((content) => {
      type.componentList.forEach((component) => {
        if (path.parse(content.name).name === component.apiName.split('.')[0]) {
          this.componentList.push(component);
          this.count++;
          component.label = `${folderType}/${content.name}`;

          if (!antiDuplicateFieldSet.has(content.name)) {
            antiDuplicateFieldSet.add(content.name);
            this.zip.addLocalFile(`${typePath}/${content.name}`, folderType);
            this.updateChunkList(type);
          }
        }
      });
    });
  }

  updateChunkList(type) {
    if (this.size > constants.MAX_SIZE_UNZIP_ATTACHMENT) {
      this.log.log(`Component Type: ${type.type}, count: ${this.count}`);
      this.chunkList[this.chunkCounter].typeList.push({ componentList: this.componentList, type: type.type, zip :  this.zip.toBuffer().toString('base64') });
      this.chunkList.push({ typeList: [] });
      this.zip = new AdmZip();
      this.size = 0;
      this.chunkCounter++;
      this.componentList = [];
      this.count = 0
    }
  }

  convertToChildType(customObjectList, childType) {
    const customFieldList = [];
    customObjectList.forEach((customObjectXML) => {
      const customFieldRows = [];
      const rows = customObjectXML.file.split('\n');
      let start = false;
      rows.forEach((row) => {

        if (
          row.includes('<?xml version="1.0" encoding="UTF-8"?>') ||
          row.startsWith('<CustomObject') ||
          row.startsWith('</CustomObject')
        ) {
          customFieldRows.push(row);
        }
        if (row.includes(`<${childType}>`)) {
          start = true;
        }
        if (start) {
          customFieldRows.push(row);
        }

        if (row.includes(`</${childType}>`)) {
          start = false;
        }

      });
      customFieldList.push({
        fileName: customObjectXML.fileName,
        file: customFieldRows.join('\n'),
        componentList: customObjectXML.componentList
      });
    });
    return customFieldList;
  }
}

module.exports = {
  MetadataTypeParser
}
