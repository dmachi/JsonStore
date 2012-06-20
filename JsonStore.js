dojo.provide("JsonStore.JsonStore");
dojo.require("dojox.json.ref");
dojo.require("dojox.json.query");
dojo.require("dojo.string");

dojox.json.ref._useRefs=true;

dojo.declare("JsonStore.JsonStore", null, {
	labelAttribute: "name",
	idAttribute: "id",
	setDirtyOnlyForIdentifiedObjects: true,

	constructor: function(kwArgs){
		this._fetchQueue=[];

		if (kwArgs){
			dojo.mixin(this, kwArgs);

			if (!this.data && !this.url){
				this.setData({});
			}

			if (this.data && !this.url){
				this.setData(this.data);

				// remove the original reference, we're in _data now
				delete this.data
			}

			if (this.url){
				this.loadData(this.url);
			}				
		}
	},
	
	loadData: function(url){
		// load data from a url, returns a deferred.  If you really want to know when data has been loaded and set, look to teh onSetData() event fired by setData()
		return dojo.xhrGet({
			url: url,
			handleAs: "text",
			handle: dojo.hitch(this, "setData"),
			error: dojo.hitch(this, function(e){
				console.error("Error loading data from url: ", e);
			})
		});
	},

	setData: function(data){
		// setup the given data set
		//console.log("setData: ", data, this._fetchQueue);

		this._index = {};
		this._refOptions = {index: this._index, assignAbsoluteIds: true, idAttribute: this.idAttribute, idPrefix:''};
		this._data = dojo.isString(data)?dojox.json.ref.fromJson(data, this._refOptions) : dojox.json.ref.resolveJson(data, this._refOptions);
		this.onSetData(this._data);
	},

	getValue: function(item, property){
		return item[property];
	},

	getValues: function(item, property){
		return dojo.isArray(item[property]) ? item[property] : [item[property]];
	},
	
	getAttributes: function(item){
			var res = [];
			for (var i in item){
				if (i!="__id"){
					res.push(i);
				}
			}
			return res;
	},

	hasAttribute: function(item, attr){
		if (attr in item){return true;}
		return false;	
	},

	containsValue: function(item, attr, value){
		// summary:
		//	Checks to see if 'item' has 'value' at 'attr'
		//
		//	item: /* object */
		//	attr: /* string */
		//	value: /* anything */

		if (item[attr] && item[attr]==value){return true}
		if (dojo.isObject(item[attr]) || dojo.isObject(value)){
			console.warn("implement shallow compare here");
		}
		return false;	
	},

	isItem: function(item){
		if (!dojo.isObject(item)){return false;}
		return true;
	},

	isItemLoaded: function(item){
		return this.isItem(item);
	},

	loadItem: function(item){
		// implment something in the future here
		return true
	},

	getFeatures: function(){
		// summary:
		// 	return the store feature set

		return { 
			"dojo.data.api.Read": true,
			"dojo.data.api.Identity": true,
			"dojo.data.api.Write": true
		}
	},

	getLabel: function(item){
		// summary
		//	returns the label for an item. The label
		//	is created by setting the store's labelAttribute 
		//	property with either an attribute name	or an array
		//	of attribute names.  Developers can also
		//	provide the store with a createLabel function which
		//	will do the actaul work of creating the label.  If not
		//	the default will just concatenate any of the identified
		//	attributes together.

		var label=[];

		if (dojo.isFunction(this.createLabel)){
			return this.createLabel(item);
		}

		if (this.labelAttribute){
			if (dojo.isArray(this.labelAttribute))	{
				for(var i=0; i<this.labelAttribute.length; i++){
					label.push(item[this.labelAttribute[i]]);
				}
				return label.join(' ');
			}else{
				return item[this.labelAttribute];
			}
		}
		return item.toString();
	},

	getLabelAttributes: function(item){
		// summary:
		//	returns an array of attributes that are used to create the label of an item
		return dojo.isArray(this.labelAttribute) ? this.labelAttribute : [this.labelAttribute];
	},

	fetch: function(args){
		//console.log("fetch() ", args);
		// summary
		//	
		//	fetch takes either a string argument or a keywordArgs
		//	object containing the parameters for the search.
		//
		//	query: /* string or object */
		//		Defaults to "$..*". jsonPath query to be performed 
		//		on data store. **note that since some widgets
		//		expect this to be an object, an object in the form
		//		of {query: '$[*'], queryOptions: "someOptions"} is
		//		acceptable	
		//
		//	queryOptions: /* object */
		//		Options passed on to the underlying jsonPath query
		//		system.
		//
		//	start: /* int */
		//		Starting item in result set
		//
		//	count: /* int */
		//		Maximum number of items to return
		//
		//	sort: /* function */
		//		Not Implemented yet
		//
		//	The following only apply to ASYNC requests (the default)
		//
		//	onBegin: /* function */
		//		called before any results are returned. Parameters
		//		will be the count and the original fetch request
		//	
		//	onItem: /*function*/
		//		called for each returned item.  Parameters will be
		//		the item and the fetch request
		//
		//	onComplete: /* function */
		//		called on completion of the request.  Parameters will	
		//		be the complete result set and the request
		//
		//	onError: /* function */
		//		colled in the event of an error

		// we're not started yet, add this request to a queue and wait till we do	
		//console.log("base Fetch: ", arguments);
		if (!args){args = {};}

		if (!this._data){
			if (dojo.isString(args)){
				console.warn("Performing a Syncronous fetch when no data exists, returning empty array."); 
				return [];
			}
			//console.log("Queueing Fetch until data arrives: ", args);
			this._fetchQueue.push(args);
			return args;
		}

		if(dojo.isString(args)){
			//return dojox.json.query(args, this._data);
			var queryStr = args;
			args = {queryStr: args, sync: true};
		}		

		var query = this._toJsonQuery(args);

		var scope = args.scope || dojo.global;
		//console.log("Do Query: ", query);
		//console.log("Query Function: ", dojox.json.query(query).toString());
		//
	
		try {
			var res= dojox.json.query(query, this._data);
		}catch(err){
			if (args.onError) {
				res= args['onError'].call(scope, err, args);
			}

			if (args.sync) {
				throw err;
			}else{
				return args;
			}
		}
		if (!dojo.isArray(res)) {
			res = [res];
		}

		var results = [];

		if ("filter" in args){
			res= args['filter'].call(scope, res, args);
		}

		if ("sort" in args){
			console.log("TODO::add support for sorting in the fetch");
		}	

		if (args.start) {
			var start = args.start;
		}else{
			start=0;
		}

		if (args.count && (args.count<res.length)) {
			var count = args.count;	
		}else{
			count = res.length;
		}
	
		if (args.onBegin){	
			args["onBegin"].call(scope, res.length, args);
		}

		results = res.slice(start, Math.min(start+count, res.length));

		if (args.onItem){
			for (var i=0; i<results.length;i++){	
				args["onItem"].call(scope, results[i], args);
			}
			if (args.onComplete) {
				args["onComplete"].call(scope,  args);
			}
		} else if (args.onComplete){
			args["onComplete"].call(scope, results, args);
		}

		if (args.sync){
			return results;
		}	

		return args;
	},

	_toJsonQuery: function(args){
		console.log("_toJsonQuery args: ", args);
		
		var ignoreCase = "=";
		
		if(args.queryOptions) {
		    if(args.queryOptions.ignoreCase) {
		        ignoreCase = "~";
		    }
		}
		
		if (args.query && dojo.isObject(args.query) && args.query.queryStr) {
			args.queryStr = args.query.queryStr;
		}

		if (args.queryStr && args.query) {
			if (dojo.isObject(args.query)){
				var jsonquery = dojo.string.substitute(args.queryStr, args.query);
				return jsonquery;	
			}else if(!args.query || args.query=='*'){
				args.query="";	
			}
				
		}else{
			// performs conversion of Dojo Data query objects and sort arrays to JSONQuery strings
			if(args.query && typeof args.query == "object"){
				// convert Dojo Data query objects to JSONQuery
				var jsonQuery = "[?(", first = true;
				for(var i in args.query){
					if(args.query[i]!="*"){ // full wildcards can be ommitted
						jsonQuery += (first ? "" : "&") + "@[" + dojo._escapeString(i) + "]" + ignoreCase + dojox.json.ref.toJson(args.query[i]);
						first = false;
					}
				}
				if(!first){
					// use ' instead of " for quoting in JSONQuery, and end with ]
					jsonQuery += ")]"; 
				}else{
					jsonQuery = "";
				}
				args.queryStr = jsonQuery.replace(/\\"|"/g,function(t){return t == '"' ? "'" : t;});
			}else if(!args.query || args.query == '*'){
				args.query = "";
			}
			
			var sort = args.sort;
			if(sort){
				// if we have a sort order, add that to the JSONQuery expression
				args.queryStr = args.queryStr || (typeof args.query == 'string' ? args.query : ""); 
				first = true;
				for(i = 0; i < sort.length; i++){
					args.queryStr += (first ? '[' : ',') + (sort[i].descending ? '\\' : '/') + "@[" + dojo._escapeString(sort[i].attribute) + "]";
					first = false; 
				}
				if(!first){
					args.queryStr += ']';
				}
			}
			if(typeof args.queryStr == 'string'){
				args.queryStr = args.queryStr.replace(/\\"|"/g,function(t){return t == '"' ? "'" : t;});
				return args.queryStr;
			}
		}	
		//console.log("Query: ", args.query);
		return args.query;
	},

	//Identity API Support

	getIdentity: function(item, absolute){
		// summary
		//	returns the identity of an item or throws
		//	a not found error.

		if (this.isItem(item)){
			return item[this.idAttribute];
		}
		return undefined;	
	},

	getIdentityAttributes: function(item){
		// summary:
		//	returns the attributes which are used to make up the 
		//	identity of an item.  

		return [this.idAttribute];
	},

	fetchItemByIdentity: function(args){
               if(dojo.isString(args)){
                        args = {identity: args, sync: true};
                }  

		if (args && args.identity){
			var res = this._index[args.identity]
		}
		var scope = args.scope || dojo.global;
		if (!res){
			if (!args.identity) {
				var err = new Error("Invalid or missing identity '" + args.identity + "' for fetchItemByIdentity.");
			}else{
				var err = new Error("fetchItemByIdentity() Item Not Found: '" + args.identity);
			}

			if (args.onError){
				arg["onError"].call(scope, err, args)		
			}
			if (args.sync){return err;}
		}
	
                if (args.onItem){
			args["onItem"].call(scope, res, args);
                }

		if (args.sync) {
			return res;
		}	

		return args;	
	},

	toJson: function(items, pretty){
		//return dojox.json.ref.toJson(items, false, null, this._index);	
		return dojox.json.ref.toJson(items, pretty, null, false);	
	
	},

	//Write API
	_setDirty: function(item){
		var id = this.getIdentity(item);
		var dirty = item;

		if (this.setDirtyOnlyForIdentifiedObjects && !id){
			var dirty = this._getIdentifiedParent(dirty);
			id = this.getIdentity(dirty);
		}else{
			if (!id){
				id = item._id;
			}
		}

		if (!this._dirtyItems){
			this._dirtyItems={};
		}

		if (!this._dirtyItems[id]){
			this._dirtyItems[id] = {
				'original': this.toJson(dirty),
				'item': dirty
			}
		}

		return this._dirtyItems[id];
	},

	_setClean: function(item){
		var id = this.getIdentity(item);
		if (!this._dirtyItems || !this._dirtyItems[id]){return;}
		delete this._dirtyItems[id];
	},

	_getIdentifiedParent: function(item){
		console.warn("_getIdentifiedParent() not implemented: ", item, item._id);
	},

	getDirtyItems: function(){
		var res = [];
		if (!this._dirtyItems) { return res; }

		for (var i in this._dirtyItems){
			var dirty = this._dirtyItems[i];
			dirty.current = this.toJson(dirty.item);
			res.push(dirty);
		}
		return res;
	},

	isDirty: function(item){
		if (!this._dirtyItems) {return false;}
		var id = item[this.idAttribute];
		if (id in this._dirtyItems){return true;}
	},

	setValue: function(item, prop, val, _notDirty){
		var modified = false;
		if (item && prop){
			var oldValue = item[prop];
			newVal = val;
			if (dojo.isObject(oldValue) || dojo.isArray(oldValue)){
				oldValue = this.toJson(oldValue);
			}

			if (dojo.isObject(newVal) || dojo.isArray(newVal)){
				newVal = this.toJson(val);	
			}	

			if (oldValue!=newVal){
				modified=true;
				if(!_notDirty){this._setDirty(item);}
				if (dojo.isObject(val) || dojo.isArray(val)) {
					item[prop]=dojox.json.ref.resolveJson(val, this._refOptions);
				}else{
					item[prop]=val;
				}
				this.onSet(item, prop, oldValue, val); 
			}
		}
		return modified;
	},

	setValues: function(item, prop, val, _notDirty){
		var modified=false;
		if (dojo.isString(val)){
			val = val.split(",");
		}	
		if (item && prop){
			oldValue = this.toJson(item[prop]);
			newVal = this.toJson(val);

			if (oldValue!=newVal){
				modified=true;
				if(!_notDirty){this._setDirty(item);}
				item[prop]=dojox.json.ref.resolveJson(val, this._refOptions);
				this.onSet(item, prop, oldValue, val); 
			}
		}
		return modified;
	},

	unsetAttribute: function(item, attr){
		if (item && attr){
			oldValue = this.toJson(item[attr]);
			this._setDirty(item);
			delete item[attr];
			this.onSet(item, attr, oldValue, null);
		}
	},

	newItem: function(kwArgs, pInfo, skipDirty){
		//console.log("newItem() ", kwArgs, pInfo);
		var i = dojo.isString(kwArgs)?dojox.json.ref.fromJson(kwArgs, this._refOptions):dojox.json.ref.resolveJson(kwArgs, this._refOptions);

		if (!skipDirty) {
			this._setDirty(i);
		}

		if (!pInfo){
			pInfo={parent: this.fetch("$")};
		}

		if (!pInfo.parent){
			pInfo={parent: this.fetch("$")};
		}

		var parent = pInfo.parent;
		var attr = pInfo.attribute;


		if (parent && attr){
			if (parent[attr]){
				pInfo.oldValue = dojox.json.ref.toJson(parent[attr]);
			}else{
				pInfo.oldValue=undefined;
			}
			this._setDirty(parent);
			if (dojo.isArray(parent[attr])){
				parent[attr].push(i);
			}else{
				parent[attr]=i;
			}
			pInfo.newValue=parent[attr];
			
		}else{
			if (dojo.isArray(parent)){
				parent.push(i);
			}else{
				//console.warn("Unable to add item to parent without attribute.  Indexing only, not adding to object graph");
			}
		}
		this.onNew(i, pInfo);	
		return i;
	},

	deleteItem: function(item){
		var id = this.getIdentity(item);
		if (!id){
			//console.warn("Item must be an identified item to delete all references, this delete only delets this single instance");
			return;
		}

		if (!this._refMap){
			this._refMap={};
		}
//		console.log("deleting: ", item);	
		var updated = [];
		JsonStore.JsonStore.deleteReferences(item, this._data, this._refMap, {idAttribute: this.idAttribute, parentSetCallback: dojo.hitch(this, function(parent, prop, i){
			//console.log("Removed Item reference from: ", parent, prop, i);
			updated.push(arguments);
		})});

		if (this._dirtyItems && this._dirtyItems[id]){delete this._dirtyItems[id];}

		this.onDeleteItem();
	},

	save: function(args){

		this._savingItems = this._dirtyItems;
		this._dirtyItems=[];	

		if (!args || !dojo.isObject(args)){
			args = {}
		}	

		var scope = args.scope || dojo.global;	
		args.savedItems = this._savingItems;
		this.onSave();

		if (args.onComplete){
			  args.onComplete.call(scope, args);	
		}
	},

	revert: function(){
		for (var i in this._dirtyItems){
			this._revertItem(this._dirtyItems[i]);
		}
	},

	revertItems: function(items){
		dojo.forEach(items, this.revertItem, this);
	},

	revertItem: function(item){
		var id = this.getIdentity(item);
		if (item){
			var id = this.getIdentity(item);
			if(this._dirtyItems[id]){
				this._revertItem(this._dirtyItems[id]);
			}
			return;
		}
	},

	_revertItem: function(dirty){
		dojox.json.ref.fromJson(dirty.original, this._refOptions);
		this.onRevert(dirty.item);
	},

	//Notification
	onSet: function(){
	},

	onDelete: function(){
	},

	onNew: function(){
	},

	onRevert: function(item){
	},

	onSave: function(args){
		this._savingItems=[];
	},

	onSetData: function(data){
		//console.log("onSetData()", data);
		//console.log("Process Fetch Queue: ", this._fetchQueue);

		dojo.forEach(this._fetchQueue, function(args){
			this.fetch(args);
		},this);

		this._fetchQueue=[];


	},

	onDeleteItem: function(){}
});

JsonStore.JsonStore.deleteReferences = function(item, data, refmap,  options){
	//console.log("deleteReferences: ", arguments);	
	var idAttr = options.idAttribute || "id";
	var cb = options.parentSetCallback;
	if (item && item[idAttr]){
		var id = item[idAttr];
	}else{
		return;	
	}

	if (refmap && id && refmap[id]){
		while (refmap[id].length>0){
			var ref = refmap[id].pop();

			if (dojo.isArray(ref.parent)){
				var original = dojox.json.ref.toJson(ref.parent);
				ref.parent.splice(ref.prop, 1);
			}else{
				var original = dojox.json.ref.toJson(data);
				delete ref.parent[ref.prop];
			}	

			if (cb){
				cb(ref.parent, ref.prop, original);
			}
		}
		delete refmap[id];
	} else if (id && data) {	
		if (dojo.isArray(data)){
			for (var i=0; i<data.length; i++){
				if (dojo.isObject(data[i])){
					if (data[i][idAttr]){
						if (data[i][idAttr]==id){
							console.warn("DELETE Item from array", data, data[i][idAttr]);
							var original = dojox.json.ref.toJson(data);
							data.splice(i, 1);
							if (cb){
								cb(data, i, original);
							}
							i--;
						}else{ 
							if (refmap){
								var _id = data[i][idAttr];

								if (!refmap[data[i][idAttr]]){
									refmap[_id]=[];
								}
								refmap[_id].push({parent: data, prop: i});
							}
						 	JsonStore.JsonStore.deleteReferences(item, data[i], refmap, options); 
						}
					}else{
						 JsonStore.JsonStore.deleteReferences(item, data[i], refmap, options); 
					}
				}else{
					if (dojo.isArray(data[i])){ JsonStore.JsonStore.deleteReferences(item, data[i], refmap, options);  }
				}
			}
		}else if (dojo.isObject(data)){
			for (var prop in data){
				//console.log("Data: ", data, "prop: ", prop, "data[prop]: ", data[prop]);
				if (data[prop]!=null && data[prop]!=undefined &&dojo.isObject(data[prop]) && data[prop][idAttr]){
					if(data[prop][idAttr]==id) {
						console.warn("DELETE Item from Object Properties", data[prop], prop);
						var original = dojox.json.ref.toJson(data);
						delete data[prop];
						if (cb){
							cb(data, prop, original);
						}
					}else{
						 if (refmap){
							var _id = data[prop][idAttr];
							if (!refmap[data[prop][idAttr]]){
								refmap[_id]=[];
							}

							refmap[_id].push({parent: data, prop: i});
						}
						JsonStore.JsonStore.deleteReferences(item, data[prop], refmap, options);		
					}
				}else{
					if (dojo.isArray(data[prop])){
						JsonStore.JsonStore.deleteReferences(item, data[prop], refmap, options);		
					}
				}
			}
		}
	}
}
