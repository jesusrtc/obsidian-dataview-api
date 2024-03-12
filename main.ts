import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { TAbstractFile, TFile } from "obsidian";

const fs = require('fs');
// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class HelloWorldPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// File creation
		this.registerEvent(this.app.vault.on('create', (file) => {
			// console.log('File created:', file.path);
			// this.updateIndex(file.path);
		}));

		// File modification
		this.registerEvent(this.app.vault.on('modify', (file) => {
			console.log('File modified:', file.path);
			this.updateIndex(file.path);
			if(file instanceof TFile) {
				this.updateOnDate(file);
				this.moveClosedToArchived(file);
			};
		}));

		// File deletion
		this.registerEvent(this.app.vault.on('delete', (file) => {
			console.log('File deleted:', file.path);
			this.updateIndex(file.path);
		}));

		// File rename
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			console.log(`File renamed from ${oldPath} to ${file.path}`);
			this.updateIndex(file.path);
		}));

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			new Notice('This is a notice jeje!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	getIsoToday() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0'); 
		const day = String(today.getDate()).padStart(2, '0');

		return `${year}-${month}-${day}`
	}

	async updateIndex(inputPath: string) {
		if (!inputPath.includes(".md")) {
			return;
		}
		console.log("Index refresh started");
		const startTime = Date.now();
		const dataview = this.app.plugins.plugins.dataview.api;
		// Retrieve pages that have a specific key-value pair in their metadata
		const pagesWithSpecificMetadata = await dataview.pages();

		// Iterate over the results and do something with them
		console.log('Pages', pagesWithSpecificMetadata);


		//const arrayPage2 = Array.from(pagesWithSpecificMetadata, ([key, value]) => ({ key, value }));
		const arrayPage = Array.from(pagesWithSpecificMetadata);
		const vaultRootPath = this.app.vault.adapter.getBasePath();
		const dataBasePath = vaultRootPath + '/Code/db_dataview_index.json';
		fs.writeFileSync(dataBasePath, JSON.stringify(arrayPage, null, 2));
		const endTime = Date.now();
		const timeElapsedInSeconds2 = (endTime - startTime) / 1000;
		console.log(`API query Index refresh completed in: ${timeElapsedInSeconds2} seconds`);
	}

	async moveClosedToArchived(file: TFile) {
		if (!file.path.includes(".md")) {
			return;
		}
		if (!file.path.includes("Tasks")) {
			return;
		}
		const {getPropertyValue} = this.app.plugins.plugins["metaedit"].api;
		const status = await getPropertyValue("status", file.path);
		if (status !== "Completed" && status !== "Closed") {
			return;
		}

		const vault = this.app.vault;
		const datePattern = /\d{4}-\d{2}-\d{2}/;		
		const isoToday = this.getIsoToday();

		let newFileName = file.name;
		// Check if file name contains yyy-mm-dd, if not add the isoToday
		if (!datePattern.test(file.name)) {
			console.log("Update will rename file to include date");
			newFileName = isoToday + ' ' + file.name;
		} 

		let newFilePath = file.path.replace(/[^/]*$/, newFileName);
		if (!file.path.includes("Archive")) {
			console.log("Update will move file to Archive");
			newFilePath = file.path.replace(/[^/]*$/, 'Archive/' + newFileName);
		}

		if(file.path === newFilePath) {
			return;
		}

		console.log("Renaming file from: ", file.path);
		console.log("Renaming file to: ", newFilePath);
		
		// Rename the file
		vault.rename(file, newFilePath).then(() => {
			console.log("File renamed successfully");
		}).catch(err => {
			console.error("Error renaming file:", err);
		});	
	}

	async updateOnDate(file: TFile) {
		if (!file.path.includes(".md")) {
			return;
		}
		const {update, autoprop, getPropertyValue} = this.app.plugins.plugins["metaedit"].api;
		//await update("status", "Completeded", file.path);
		const updatedOn = await getPropertyValue("updated_on", file.path);
		const isoToday = this.getIsoToday();
		if(updatedOn != isoToday) {
			console.log("Updating updated_on");
			await update("updated_on", isoToday, file.path);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
