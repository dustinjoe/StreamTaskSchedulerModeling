/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Thu Aug 27 2015 14:29:24 GMT-0500 (Central Daylight Time).
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'common/core/users/serialization'
], function (PluginConfig,
             PluginBase,
             serialization) {
    'use strict';

    /**
     * Initializes a new instance of ExportImport.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ExportImport.
     * @constructor
     */
    var ExportImport = function () {
        // Call base class' constructor.
        PluginBase.call(this);
    };

    // Prototypal inheritance from PluginBase.
    ExportImport.prototype = Object.create(PluginBase.prototype);
    ExportImport.prototype.constructor = ExportImport;

    /**
     * Gets the name of the ExportImport.
     * @returns {string} The name of the plugin.
     * @public
     */
    ExportImport.prototype.getName = function () {
        return 'Export, Import and Update Library';
    };

    /**
     * Gets the semantic version (semver.org) of the ExportImport.
     * @returns {string} The version of the plugin.
     * @public
     */
    ExportImport.prototype.getVersion = function () {
        return '0.14.0';
    };

    /**
     * Gets the description of the ExportImport.
     * @returns {string} The description of the plugin.
     * @public
     */
    ExportImport.prototype.getDescription = function () {
        return 'Example of how to export, import and update a library from and to webgme.\n' +
            'The active node (i.e. open node on the canvas) will be the starting point, ' +
            'expect when importing a project.';
    };

    /**
     * Gets the configuration structure for the ExportImport.
     * The ConfigurationStructure defines the configuration for the plugin
     * and will be used to populate the GUI when invoking the plugin from webGME.
     * @returns {object} The version of the plugin.
     * @public
     */
    ExportImport.prototype.getConfigStructure = function () {
        return [
            {
                name: 'type',
                displayName: 'Type',
                description: 'What library action should be taken?',
                value: 'Export',
                valueType: 'string',
                valueItems: [
                    'Export',
                    'ImportProject',
                    'ImportLibrary',
                    'UpdateLibrary'
                ]
            },
            {
                name: 'file',
                displayName: 'Webgme library file.',
                description: 'Provide an export json file when importing or updating.',
                value: '',
                valueType: 'asset',
                readOnly: false
            }
        ];
    };


    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ExportImport.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            currentConfig = self.getCurrentConfig();

        if (currentConfig.type === 'Export') {
            self.exportLibrary(currentConfig, callback);
        } else if (currentConfig.type === 'ImportProject') {
            self.importOrUpdateLibrary(currentConfig, callback);
        } else if (currentConfig.type === 'ImportLibrary') {
            self.importOrUpdateLibrary(currentConfig, callback);
        } else if (currentConfig.type === 'UpdateLibrary') {
            self.importOrUpdateLibrary(currentConfig, callback);
        } else {
            callback(new Error('Unexpected type ' + currentConfig.type), self.result);
        }
    };

    ExportImport.prototype.exportLibrary = function (currentConfig, callback) {
        var self = this,
            artie,
            jsonStr;
        serialization.export(self.core, self.activeNode, function (err, projectJson) {
            if (err) {
                callback(err, self.result);
                return;
            }
            jsonStr = JSON.stringify(projectJson, null, 4);
            self.logger.info(projectJson);
            artie = self.blobClient.createArtifact('exported');
            artie.addFile('lib.json', jsonStr, function (err/*, hash*/) {
                if (err) {
                    callback(err, self.result);
                    return;
                }
                self.blobClient.saveAllArtifacts(function (err, hashes) {
                    if (err) {
                        callback(err, self.result);
                        return;
                    }
                    self.result.addArtifact(hashes[0]);
                    self.result.setSuccess(true);
                    callback(null, self.result);
                });
            });
        });
    };

    ExportImport.prototype.importOrUpdateLibrary = function (currentConfig, callback) {
        var self = this,
            libraryRoot;

        self.getLibObject(currentConfig, function (err, libObject) {
            if (err) {
                callback(err, self.result);
                return;
            }

            if (currentConfig.type === 'ImportLibrary') {
                if (libObject.root.path === '') {
                    callback(new Error('Root path in json is empty string and exported from a root - ' +
                        'use ImportProject.'), self.result);
                    return;
                }
                libraryRoot = self.core.createNode({
                    parent: self.activeNode,
                    base: null
                });
                self.core.setAttribute(libraryRoot, 'name', 'Import Library');
            } else if (currentConfig.type === 'UpdateLibrary') {
                if (libObject.root.path === '') {
                    callback(new Error('Root path in json is empty string and exported from a root - ' +
                        'use ImportProject.'), self.result);
                    return;
                }
                libraryRoot = self.activeNode;
            } else if (currentConfig.type === 'ImportProject') {
                if (libObject.root.path !== '') {
                    callback(new Error('Root path in json is not empty string and not exported from a root node - ' +
                        'use Import/UpdateLibrary'), self.result);
                    return;
                }
                libraryRoot = self.rootNode;
            }

            serialization.import(self.core, libraryRoot, libObject, function (err) {
                if (err) {
                    callback(err, self.result);
                    return;
                }
                self.save('Imported Library to "' + self.core.getPath(self.activeNode) + '"', function (err) {
                    if (err) {
                        callback(err, self.result);
                        return;
                    }
                    self.createMessage(self.activeNode, 'Library imported');
                    self.result.setSuccess(true);
                    callback(null, self.result);
                });
            });
        });
    };

    ExportImport.prototype.getLibObject = function (currentConfig, callback) {
        var self = this;
        if (!currentConfig.file) {
            self.result.setError('Add a json file when importing or updating.');
            callback(new Error('No file provided.'));
            return;
        }

        self.blobClient.getObject(currentConfig.file, function (err, libOrBuf) {
            var libObject;
            if (err) {
                callback(err);
                return;
            }

            if (typeof Buffer !== 'undefined' && libOrBuf instanceof Buffer) {
                try {
                    libOrBuf = String.fromCharCode.apply(null, new Uint8Array(libOrBuf));
                    libObject = JSON.parse(libOrBuf);
                    callback(null, libObject);
                } catch (err) {
                    callback(err);
                    return;
                }
            } else {
                callback(null, libOrBuf);
            }
        });
    };

    return ExportImport;
});