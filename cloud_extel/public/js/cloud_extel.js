(function () {
	'use strict';

	var doctypes_with_dimensions = ["GL Entry", "Sales Invoice", "Purchase Invoice", "Payment Entry", "Asset",
	"Expense Claim", "Stock Entry", "Budget", "Payroll Entry", "Delivery Note", "Shipping Rule", "Loyalty Program",
	"Fee Schedule", "Fee Structure", "Stock Reconciliation", "Travel Request", "Fees", "POS Profile", "Opening Invoice Creation Tool",
	"Subscription", "Purchase Order", "Journal Entry", "Material Request", "Purchase Receipt", "Landed Cost Item", "Asset"];


	doctypes_with_dimensions.forEach(function (doctype) {
		frappe.ui.form.on(doctype, {
			cost_center: function(frm) {
				frappe.call({
					'method': 'frappe.client.get_list',
					'args': {
						'filters':{
							'business_segment': frm.doc.cost_center},
							'doctype': 'Business Segment',
							'fields': ['parent'],
							'parent': 'Telecom Region',
							'limit_page_length': 300
						},
					'callback': function(r) {
						frm.set_query('telecom_region', function() {
							var region_list = r.message;
							region_list = region_list.map(function (pt) { return pt.parent; });

							return {
								filters: {
									'name': ['in', region_list]
								}
							}
						});
					}
				});
			},
		});
	});

	frappe.provide('frappe.views');
	frappe.provide("erpnext.projects");

	erpnext.projects.ProjectTree = class Projects extends frappe.views.BaseList {
		constructor(opts) {
			super(opts);
			this.show();
			window.cur_list = this;
			this.hide_sort_selector = true;
			this.view_name = 'List';
		}

		setup_defaults() {
			super.setup_defaults();

			this.task_meta = frappe.get_meta("Task");

			this.task_fields = [];
			this.task_columns = [];
			this.get_settings("Project", "project_listview_settings");
			this.get_settings("Task", "task_listview_settings");

			this.menu_items = [];
		}

		setup_page() {
			this.$page = $(this.parent);
			this.page && this.page.page_form.removeClass('row').addClass('flex');
			this.page && this.page.body.addClass('frappe-card');
			this.setup_page_head();
		}

		setup_page_head() {
			this.set_title("Projects");
			this.set_menu_items("Project");
			this.set_breadcrumbs();
		}

		set_menu_items(doctype) {
			var this$1 = this;


			var bulk_delete = function () {
				return {
					label: __('Delete'),
					action: function () {
						var docnames = this$1.get_checked_items(true).map(function (docname) { return docname.toString(); });
						frappe.confirm(__('Delete {0} items permanently?', [docnames.length]),
							function () {
								frappe.call({
									method: 'frappe.desk.reportview.delete_items',
									freeze: true,
									args: {
										items: docnames,
										doctype: doctype
									}
								}).then(function (r) {
									var failed = r.message;
									if (!failed) { failed = []; }

									if (failed.length && !r._server_messages) {
										frappe.throw(__('Cannot delete {0}', [failed.map(function (f) { return f.bold(); }).join(', ')]));
									}

									if (failed.length < docnames.length) {
										frappe.utils.play_sound('delete');
									}

									this$1.refresh();
								});
							});
					},
					standard: true,
				};
			};

			// if (frappe.user.has_role('System Manager')) {
			// 	this.menu_items.push({
			// 		label: __('Project Settings'),
			// 		action: () => this.show_list_settings("Project", this.listview_settings),
			// 		standard: true
			// 	});

			// 	this.menu_items.push({
			// 		label: __('Task Settings'),
			// 		action: () => this.show_list_settings("Task", this.task_listview_settings),
			// 		standard: true
			// 	});
			// }

			// bulk delete
			if (frappe.model.can_delete(doctype)) {
				this.menu_items.push(bulk_delete());
			}

			this.page && this.menu_items.map(function (item) {
				var $item = this$1.page.add_menu_item(item.label, item.action, item.standard, item.shortcut);
				if (item.class) {
					$item && $item.addClass(item.class);
				}
			});
		}

		// show_list_settings(doctype, settings) {
		// 	frappe.model.with_doctype(doctype, () => {
		// 		new frappe.views.ListSettings({
		// 			listview: this,
		// 			doctype: doctype,
		// 			settings: settings,
		// 			meta: frappe.get_meta(doctype)
		// 		});
		// 	});
		// }

		refresh_columns() {
			this.show();
		}

		set_title(title) {
			this.page && this.page.set_title(title);
		}

		setup_view() {
			this.columns = this.setup_columns("Project", this.meta, this.project_listview_settings);
			this.task_columns = this.setup_columns("Task", this.task_meta, this.task_listview_settings);

			this.render_header(this.columns);
			this.render_skeleton();
			this.setup_events();
		}

		setup_fields() {
			super.setup_fields();

			this.set_task_fields();
			this.build_task_fields();
		}

		set_task_fields() {
			var this$1 = this;

			var fields = [].concat(
				frappe.model.std_fields_list,
				this.get_fields_in_list_view("Task", this.task_meta),
				[this.meta.title_field, this.meta.image_field],
				(this.settings.add_fields || []),
				this.meta.track_seen ? '_seen' : null,
				this.sort_by,
				'enabled',
				'disabled',
				'color'
			);

			fields.forEach(function (f) { return this$1._add_task_field(f); });

			this.task_fields.forEach(function (f) {
				var df = frappe.meta.get_docfield(f[1], f[0]);
				if (df && df.fieldtype === 'Currency' && df.options && !df.options.includes(':')) {
					this$1._add_field(df.options);
				}
			});
		}

		build_task_fields() {
			var this$1 = this;

			// fill in missing doctype
			this.task_fields = this.task_fields.map(function (f) {
				if (typeof f === 'string') {
					f = [f, this$1.doctype];
				}
				return f;
			});
			// remove null or undefined values
			this.task_fields = this.task_fields.filter(Boolean);
			// de-duplicate
			this.task_fields = this.task_fields.uniqBy(function (f) { return f[0] + f[1]; });
		}

		_add_task_field(fieldname) {
			if (!fieldname) { return; }
			var doctype = "Task";

			if (typeof fieldname === 'object') {
				// df is passed
				var df = fieldname;
				fieldname = df.fieldname;
				doctype = df.parent;
			}

			var is_valid_field = frappe.model.std_fields_list.includes(fieldname)
				|| frappe.meta.has_field(doctype, fieldname)
				|| fieldname === '_seen';

			if (!is_valid_field) {
				return;
			}

			this.task_fields.push([fieldname, doctype]);
		}

		get_df(doctype, fieldname) {
			return frappe.meta.get_docfield(doctype, fieldname);
		}

		setup_columns(doctype, meta, list_view_settings) {
			// setup columns for list view
			var columns = [];

			// 1st column: title_field or name
			if (meta.title_field) {
				columns.push({
					type: 'Subject',
					df: this.get_df(doctype, meta.title_field)
				});
			} else {
				columns.push({
					type: 'Subject',
					df: {
						label: __('Name'),
						fieldname: 'name'
					}
				});
			}

			// 2nd column: Status indicator
			if (frappe.has_indicator(doctype)) {
				// indicator
				columns.push({
					type: 'Status'
				});
			}

			var fields_in_list_view = this.get_fields_in_list_view(doctype, meta);
			// Add rest from in_list_view docfields
			columns = columns.concat(
				fields_in_list_view
					.filter(function (df) {
						if (frappe.has_indicator(doctype) && df.fieldname === 'status') {
							return false;
						}
						if (!df.in_list_view) {
							return false;
						}
						return df.fieldname !== meta.title_field;
					})
					.map(function (df) { return ({
						type: 'Field',
						df: df
					}); })
			);

			if (list_view_settings && list_view_settings.fields) {
				columns = this.reorder_listview_fields(columns, list_view_settings.fields);
			}

			// limit max to 8 columns if no total_fields is set in List View Settings
			// Screen with low density no of columns 4
			// Screen with medium density no of columns 6
			// Screen with high density no of columns 8
			var total_fields = 6;

			if (window.innerWidth <= 1366) {
				total_fields = 4;
			} else if (window.innerWidth >= 1920) {
				total_fields = 8;
			}

			if (list_view_settings && list_view_settings.total_fields) {
				total_fields = parseInt(list_view_settings.total_fields);
			}

			return columns.slice(0, total_fields);
		}

		reorder_listview_fields(columns, fields) {
			var fields_order = [];
			fields = JSON.parse(fields);

			// title_field is fixed
			fields_order.push(columns[0]);
			columns.splice(0, 1);

			for (var fld in fields) {
				for (var col in columns) {
					var field = fields[fld];
					var column =columns[col];

					if (column.type == "Status" && field.fieldname == "status_field") {
						fields_order.push(column);
						break;
					} else if (column.type == "Field" && field.fieldname === column.df.fieldname) {
						fields_order.push(column);
						break;
					}
				}
			}

			return fields_order;
		}

		get_fields_in_list_view(doctype, meta) {
			return meta.fields.filter(function (df) {
				return frappe.model.is_value_type(df.fieldtype) && (
					df.in_list_view
					&& frappe.perm.has_perm(doctype, df.permlevel, 'read')
				) || (
					df.fieldtype === 'Currency'
					&& df.options
					&& !df.options.includes(':')
				) || (
					df.fieldname === 'status'
				);
			});
		}

		render_skeleton() {
			var $row = this.get_list_row_html_skeleton('<div><input type="checkbox" /></div>');
			this.$result.append($row);
		}

		set_fields() {
			var this$1 = this;

			var fields = [].concat(
				frappe.model.std_fields_list,
				this.get_fields_in_list_view("Project", this.meta),
				[this.meta.title_field, this.meta.image_field],
				(this.settings.add_fields || []),
				this.meta.track_seen ? '_seen' : null,
				this.sort_by,
				'enabled',
				'disabled',
				'color'
			);

			fields.forEach(function (f) { return this$1._add_field(f); });

			this.fields.forEach(function (f) {
				var df = frappe.meta.get_docfield(f[1], f[0]);
				if (df && df.fieldtype === 'Currency' && df.options && !df.options.includes(':')) {
					this$1._add_field(df.options);
				}
			});
		}

		get_task_fields() {
			// convert [fieldname, Doctype] => tabDoctype.fieldname
			return this.task_fields.map(function (f) { return frappe.model.get_full_column_name(f[0], f[1]); });
		}

		get_call_args(filters) {
			return {
				method: "cloud_extel.cloud_extel.page.project_treeview.project_treeview.get_projects_data",
				args: {
					params: {
						doctype: "Project",
						fields: this.get_fields(),
						filters: filters || this.get_filters_for_args(),
						with_comment_count: true,
						page_length: this.page_length,
						start: this.start
					}
				}
			};
		}

		get_task_call_args(filters) {
			return {
				method: "cloud_extel.cloud_extel.page.project_treeview.project_treeview.get_tasks",
				args: {
					params: {
						doctype: "Task",
						fields: this.get_task_fields(),
						filters: filters,
						with_comment_count: true,
						page_length: this.page_length,
					}
				}
			};
		}

		setup_side_bar() {}

		get_settings(doctype, attr) {
			var this$1 = this;

			return frappe.call({
				method: "frappe.desk.listview.get_list_settings",
				args: {
					doctype: doctype
				},
				async: false
			}).then(function (doc) { return this$1[attr] = doc.message || {}; });
		}

		setup_events() {
			this.get_tasks();
			this.setup_check_events();
			this.setup_open_doc();
			this.setup_task_tree_dropdown();
			this.setup_create_new_task();
			this.get_projects();
			this.setup_expand_all_rows();
			this.setup_collapse_all_rows();
		}

		setup_task_tree_dropdown() {
			var this$1 = this;

			this.$result.on('click', 'svg.icon', function (e) {
				var el = e.currentTarget;
				var $el = $(el);
				$el.find("use.mb-1").attr("href", "#icon-down");

				var target = unescape(el.getAttribute("data-name"));
				this$1.render_task(target, $el);
			});
		}

		render_task(task, $el, expand_all) {
			var this$1 = this;

			var $row = this.$result.find((".list-rows[data-name=\"" + task + "\"]"));
			if (!$row || (!$row.length)) { return; }

			if (!$el) {
				$el = $row.find("use.mb-1").attr("href", "#icon-down");
			}

			var list = $row.find(".nested-list-row-container");
			var $list = $(list);
			var level = parseInt($row[0].getAttribute("data-level")) + 1;
			var $result = $("<div class=\"nested-result\">");

			$list.toggleClass("hide");

			if ($list[0].classList.contains("hide")) {
				$list.find(".nested-result").remove();
				$el.find("use.mb-1").attr("href", "#icon-right");
			}

			frappe.call(this.get_task_call_args([["Task", "parent_task", "=", task]])).then(function (r) {
				// render
				this$1.prepare_data(r);

				list.append($result);
				this$1.data.map(function (doc, i) {
					doc._idx = i;
					doc.doctype = 'Task';
					$result.append(this$1.get_task_list_row_html(doc, level));
				});

				if (expand_all) {
					this$1.$result.find(".expand-all").click();
				}
			});
		}

		setup_open_doc() {
			this.$result.on('click', '.btn-open', function (e) {
				e.stopPropagation();
				var el = e.currentTarget;
				var doctype = unescape(el.getAttribute("data-doctype"));
				var name = unescape(el.getAttribute("data-name"));
				frappe.set_route("Form", doctype, name);
			});
		}

		setup_create_new_task() {
			this.$result.on('click', '.create-new', function (e) {
				var parent = unescape(e.currentTarget.getAttribute("data-name"));
				var project = unescape(e.currentTarget.getAttribute("data-project"));
				var task = frappe.model.get_new_doc("Task");
				task["project"] = project;
				task["parent_task"] = parent;

				frappe.ui.form.make_quick_entry("Task", null, null, task);
			});
		}

		get_projects() {
			var this$1 = this;

			this.$frappe_list.on('click', '.btn-prev', function () {
				this$1.filter_area.clear(false);
				this$1.set_title("Project");
				this$1.remove_previous_button();
				this$1.render_header(this$1.columns, true);
				this$1.filter_area.refresh_filters(this$1.meta);
				this$1.fetch_projects();
			});
		}

		fetch_projects() {
			var this$1 = this;

			frappe.call(this.get_call_args([])).then(function (r) {
				// render
				this$1.render_header(this$1.columns, true);
				this$1.prepare_data(r);
				this$1.toggle_result_area();
				this$1.render();
			});
		}

		get_tasks() {
			var this$1 = this;

			this.$result.on('click', '.project-list-row-container', function (e) {
				this$1.filter_area.clear(false);
				this$1.set_title("Task Tree");
				this$1.filter_area.refresh_filters(this$1.task_meta);
				this$1.fetch_tasks(unescape(e.currentTarget.getAttribute("data-name")));
			});
		}

		fetch_tasks(project) {
			var this$1 = this;

			if (project) {
				this.filter_area.add([["Task", "project", "=", project]], false);
			}

			var filters = this.get_filters_for_args();
			filters.push(["Task", "parent_task", "=", '']);

			frappe.call(this.get_task_call_args(filters)).then(function (r) {
				// render
				this$1.render_header(this$1.task_columns, true);
				this$1.prepare_data(r);

				this$1.render("Task", true, project);
				this$1.render_previous_button();
			});
		}

		setup_expand_all_rows() {
			var this$1 = this;

			this.$result.on('click', '.expand-all', function () {
				var task_list = this$1.$result.find("use[href='#icon-right']").parent();
				this$1.toggle_expand_collapse_button('expand');

				if (!task_list) { return }
				task_list.map(function (i, task) {
					var task_name = task.getAttribute("data-name");
					if (task_name) {
						this$1.render_task(task_name, null, true);
					}
				});
			});
		}

		setup_collapse_all_rows() {
			var this$1 = this;

			this.$result.on('click', '.collapse-all', function () {
				var task_list = this$1.$result.find("use[href='#icon-down']").parent();
				this$1.toggle_expand_collapse_button('collapse');

				if (!task_list) { return }
				task_list.map(function (i, task) {
					var task_name = task.getAttribute("data-name");
					var $row = this$1.$result.find((".list-rows[data-name=\"" + task_name + "\"]"));
					var list = $row.find(".nested-list-row-container");
					var $list = $(list);
					$list.toggleClass("hide");

					if ($list.length && $list[0].classList.contains("hide")) {
						$list.find(".nested-result").remove();
						$row.find("use.mb-1").attr("href", "#icon-right");
					}
				});

			});
		}

		toggle_expand_collapse_button(action) {
			var hide = (action == 'expand') ? '.expand-all': '.collapse-all';
			var show = (action == 'expand') ? '.collapse-all': '.expand-all';

			this.$result.find(hide).hide();
			this.$result.find(show).show();
		}

		render(doctype, is_task, project) {
			var this$1 = this;
			if ( is_task === void 0 ) is_task=false;
			if ( project === void 0 ) project=null;

			// clear rows
			this.$result.find('.list-row-container').remove();
			if (this.data.length > 0) {
				// append rows
				this.$result.append(
					this.data.map(function (doc, i) {
						doc._idx = i;
						doc.doctype = doctype || this$1.doctype;

						if (is_task && project) {
							doc.project = project;
						}

						return is_task ? this$1.get_task_list_row_html(doc, 0) : this$1.get_list_row_html(doc);
					}).join('')
				);
			}
		}

		setup_no_result_area() {
			this.$no_result = $(("\n\t\t\t<div class=\"no-result text-muted flex justify-center align-center\">\n\t\t\t\t" + (this.get_no_result_message()) + "\n\t\t\t</div>\n\t\t")).hide();
			this.$no_result_prev = $(this.get_previous_header_html()).hide();

			this.$frappe_list.append(this.$no_result_prev);
			this.$frappe_list.append(this.$no_result);
		}

		toggle_result_area() {
			this.$result.toggle(this.data.length > 0);
			this.$paging_area.toggle(this.data.length > 0);
			this.$no_result.toggle(this.data.length == 0);
			this.$no_result_prev.toggle(this.data.length == 0);

			var show_more = (this.start + this.page_length) <= this.data.length;
			this.$paging_area.find('.btn-more')
				.toggle(show_more);
		}

		setup_filter_area() {
			this.filter_area = new erpnext.projects.CustomFilterArea(this);

			if (this.filters && this.filters.length > 0) {
				return this.filter_area.set(this.filters);
			}
		}

		get_list_row_html(doc) {
			return this.get_list_row_html_skeleton(this.get_left_html(this.columns, doc), this.get_right_html(doc), doc);
		}

		get_task_list_row_html(doc, level) {
			return this.get_task_list_row_html_skeleton(this.get_left_html(this.task_columns, doc, level), this.get_right_html(doc, true), doc, level);
		}

		get_list_row_html_skeleton(left, right, doc) {
			if ( left === void 0 ) left = '';
			if ( right === void 0 ) right = '';
			if ( doc === void 0 ) doc = {};

			return ("\n\t\t\t<div class=\"list-row-container project-list-row-container\" tabindex=\"1\" data-doctype=\"Project\" data-name=\"" + (escape(doc.name)) + "\">\n\t\t\t\t<div class=\"level list-row small\">\n\t\t\t\t\t<div class=\"level-left ellipsis\">\n\t\t\t\t\t\t" + left + "\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"level-right text-muted ellipsis\">\n\t\t\t\t\t\t" + right + "\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t");
		}

		get_task_list_row_html_skeleton(left, right, doc, level) {
			if ( left === void 0 ) left = '';
			if ( right === void 0 ) right = '';
			if ( doc === void 0 ) doc = {};

			return ("\n\t\t<div class=\"list-rows\" data-doctype=\"Task\" data-name=\"" + (escape(doc.name)) + "\" data-level=\"" + level + "\">\n\t\t\t<div class=\"list-row-container\" tabindex=\"1\">\n\t\t\t\t<div class=\"level list-row small\">\n\t\t\t\t\t<div class=\"level-left ellipsis\">\n\t\t\t\t\t\t" + left + "\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"level-right text-muted ellipsis\">\n\t\t\t\t\t\t" + right + "\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<div class=\"nested-list-row-container hide\">\n\t\t\t</div>\n\t\t</div>\n\t\t");
		}

		get_left_html(columns, doc, level) {
			var this$1 = this;

			return columns.map(function (col) { return this$1.get_column_html(col, columns, doc, level); }).join('');
		}

		get_right_html(doc, create_new) {
			if ( create_new === void 0 ) create_new=false;

			return this.get_meta_html(doc, create_new);
		}

		get_column_html(col, columns, doc, level) {
			var this$1 = this;

			if (col.type === 'Status') {
				return ("\n\t\t\t\t<div class=\"list-row-col hidden-xs ellipsis\">\n\t\t\t\t\t" + (this.get_indicator_html(doc)) + "\n\t\t\t\t</div>\n\t\t\t");
			}

			var df = col.df || {};
			var label = df.label;
			var fieldname = df.fieldname;
			var value = doc[fieldname] || '';

			var format = function () {
				if (df.fieldtype === 'Code') {
					return value;
				} else if (df.fieldtype === 'Percent') {
					return ("<div class=\"progress level\" style=\"margin: 0px;\">\n\t\t\t\t\t\t<div class=\"progress-bar progress-bar-success\" role=\"progressbar\"\n\t\t\t\t\t\t\taria-valuenow=\"" + value + "\"\n\t\t\t\t\t\t\taria-valuemin=\"0\" aria-valuemax=\"100\" style=\"width: " + (Math.round(value)) + "%;\">\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>");
				} else {
					return frappe.format(value, df, null, doc);
				}
			};

			var field_html = function () {
				var html;
				var _value;
				// listview_setting formatter
				if (this$1.settings.formatters && this$1.settings.formatters[fieldname]) {
					_value = this$1.settings.formatters[fieldname](value, df, doc);
				} else {
					var strip_html_required = df.fieldtype == 'Text Editor'
						|| (df.fetch_from && ['Text', 'Small Text'].includes(df.fieldtype));
					if (strip_html_required) {
						_value = strip_html(value);
					} else {
						_value = typeof value === 'string' ? frappe.utils.escape_html(value) : value;
					}
				}

				if (df.fieldtype === 'Image') {
					html = df.options ?
						("<img src=\"" + (doc[df.options]) + "\" style=\"max-level: 30px; max-width: 100%;\">") :
						"<div class=\"missing-image small\">\n\t\t\t\t\t\t<span class=\"octicon octicon-circle-slash\"></span>\n\t\t\t\t\t</div>";
				} else if (df.fieldtype === 'Select') {
					html = "<span class=\"filterable indicator " + (frappe.utils.guess_colour(_value)) + " ellipsis\"\n\t\t\t\t\tdata-filter=\"" + fieldname + ",=," + value + "\">\n\t\t\t\t\t" + (__(_value)) + "\n\t\t\t\t</span>";
				} else if (df.fieldtype === 'Link') {
					html = "<a class=\"filterable text-muted ellipsis\"\n\t\t\t\t\tdata-filter=\"" + fieldname + ",=," + value + "\">\n\t\t\t\t\t" + _value + "\n\t\t\t\t</a>";
				} else if (['Text Editor', 'Text', 'Small Text', 'HTML Editor'].includes(df.fieldtype)) {
					html = "<span class=\"text-muted ellipsis\">\n\t\t\t\t\t" + _value + "\n\t\t\t\t</span>";
				} else {
					html = "<a class=\"filterable text-muted ellipsis\"\n\t\t\t\t\tdata-filter=\"" + fieldname + ",=," + value + "\">\n\t\t\t\t\t" + (format()) + "\n\t\t\t\t</a>";
				}

				return ("<span class=\"ellipsis\"\n\t\t\t\ttitle=\"" + (__(label)) + ": " + (escape(_value)) + "\">\n\t\t\t\t" + html + "\n\t\t\t</span>");
			};

			var class_map = {
				Subject: 'list-subject level',
				Field: 'hidden-xs'
			};
			var css_class = [
				'list-row-col ellipsis',
				class_map[col.type],
				frappe.model.is_numeric_field(df) ? 'text-right' : ''
			].join(' ');

			var html_map = {
				Subject: this.get_subject_html(columns, doc, level),
				Field: field_html()
			};
			var column_html = html_map[col.type];

			return ("\n\t\t\t<div class=\"" + css_class + "\">\n\t\t\t\t" + column_html + "\n\t\t\t</div>\n\t\t");
		}

		get_subject_html(columns, doc, level) {
			var user = frappe.session.user;
			var subject_field = columns[0].df;
			var value = doc[subject_field.fieldname] || doc.name;
			var subject = strip_html(value.toString());
			var escaped_subject = frappe.utils.escape_html(subject);

			var seen = JSON.parse(doc._seen || '[]').includes(user) ? '' : 'bold';

			var subject_link = this.get_subject_link(doc, subject, escaped_subject);

			// let html = doc.doctype == 'Task' && doc.expandable ? `<a class="btn btn-action btn-xs"
			// 	data-doctype="Task" data-name="${escape(doc.name)}" style="width: 20px;">
			// 		<i class="octicon octicon-chevron-right" />
			// 	</a>` : ``;

			var html = doc.doctype == 'Task' && doc.expandable ? ("<svg class=\"icon icon-sm\" style=\"\"\n\t\t\tdata-doctype=\"Task\" data-name=\"" + (escape(doc.name)) + "\">\n\t\t\t\t<use class=\"mb-1\" href=\"#icon-right\"></use>\n\t\t\t</svg>") : "";

			var subject_html = "\n\t\t\t<span class=\"level-item select-like\">\n\t\t\t\t<input class=\"list-row-checkbox\" type=\"checkbox\" data-name=\"" + (escape(doc.name)) + "\">\n\t\t\t\t<span class=\"list-row-like hidden-xs style=\"margin-bottom: 1px;\">\n\t\t\t\t\t" + (this.get_like_html(doc)) + "\n\t\t\t\t</span>\n\t\t\t</span>\n\t\t\t<span class=\"level-item " + seen + " ellipsis\" title=\"" + escaped_subject + "\" style=\"padding-left: " + (20*level) + "px;\">\n\t\t\t\t<span class=\"level-item\" style=\"margin-bottom: 1px;\"\">\n\t\t\t\t\t" + html + "\n\t\t\t\t</span>\n\t\t\t\t" + subject_link + "\n\t\t\t</span>\n\t\t";

			return subject_html;
		}

		get_like_html(doc) {
			var liked_by = JSON.parse(doc._liked_by || "[]");
			var heart_class = liked_by.includes(frappe.session.user)
				? "liked-by liked"
				: "not-liked";

			return ("<span\n\t\t\tclass=\"like-action " + heart_class + "\"\n\t\t\tdata-name=\"" + (doc.name) + "\" data-doctype=\"" + (this.doctype) + "\"\n\t\t\tdata-liked-by=\"" + (encodeURI(doc._liked_by) || "[]") + "\"\n\t\t\ttitle=\"" + (liked_by.map(function (u) { return frappe.user_info(u).fullname; }).join(', ')) + "\">\n\t\t\t" + (frappe.utils.icon('heart', 'sm', 'like-icon')) + "\n\t\t</span>\n\t\t<span class=\"likes-count\">\n\t\t\t" + (liked_by.length > 99 ? __("99") + "+" : __(liked_by.length || "")) + "\n\t\t</span>");
		}

		get_subject_link(doc, subject, escaped_subject) {
			if (doc.doctype === 'Project') {
				return ("<span class=\"ellipsis\" title=\"" + escaped_subject + "\" data-doctype=\"" + (doc.doctype) + "\" data-name=\"" + (doc.name) + "\">\n\t\t\t\t" + subject + "\n\t\t\t</span>");
			} else {
				return ("<a href =\"/app/task/" + (doc.name) + "\" class=\"ellipsis\" title=\"" + escaped_subject + "\" data-doctype=\"" + (doc.doctype) + "\" data-name=\"" + (doc.name) + "\">\n\t\t\t\t" + subject + "\n\t\t\t</a>");
			}
		}

		get_indicator_html(doc) {
			var indicator = frappe.get_indicator(doc, this.doctype);
			if (indicator) {
				return ("<span class=\"indicator " + (indicator[1]) + " filterable\"\n\t\t\t\tdata-filter='" + (indicator[2]) + "'>\n\t\t\t\t" + (__(indicator[0])) + "\n\t\t\t<span>");
			}
			return '';
		}

		get_indicator_dot(doc) {
			var indicator = frappe.get_indicator(doc, this.doctype);
			if (!indicator) { return ''; }
			return ("<span class='indicator " + (indicator[1]) + "' title='" + (__(indicator[0])) + "'></span>");
		}

		get_avatar(last_assignee) {
			return ("<span class=\"filterable\"\n\t\t\t\tdata-filter=\"_assign,like,%" + last_assignee + "%\">\n\t\t\t\t" + (frappe.avatar(last_assignee)) + "\n\t\t\t</span>")
		}

		get_meta_html(doc, create_new) {
			var html = '';

			if (create_new && doc.is_group) {
				html += this.get_add_child_button(doc);
			}

			if (doc.doctype == 'Project') {
				html += this.get_open_button(doc);
			}

			var modified = this.comment_when(doc.modified, true);

			var last_assignee = JSON.parse(doc._assign || '[]').slice(-1)[0];
			var assigned_to = last_assignee ?
				this.get_avatar(last_assignee) :
				"<span class=\"avatar avatar-small avatar-empty\"></span>";

			var comment_count =
				"<span class=\"" + (!doc._comment_count ? 'text-extra-muted' : '') + " comment-count\">\n\t\t\t\t<i class=\"octicon octicon-comment-discussion\"></i>\n\t\t\t\t" + (doc._comment_count > 99 ? "99+" : doc._comment_count) + "\n\t\t\t</span>";

			html += "\n\t\t\t<div class=\"level-item hidden-xs list-row-activity\">\n\t\t\t\t" + modified + "\n\t\t\t\t" + assigned_to + "\n\t\t\t\t" + comment_count + "\n\t\t\t</div>\n\t\t\t<div class=\"level-item visible-xs text-right\">\n\t\t\t\t" + (this.get_indicator_dot(doc)) + "\n\t\t\t</div>\n\t\t";

			return html;
		}

		get_open_button(doc) {
			return ("\n\t\t\t\t<div class=\"level-item hidden-xs mr-3\">\n\t\t\t\t\t<button class=\"btn btn-open btn-default btn-xs\"\n\t\t\t\t\t\tdata-doctype=\"" + (escape(doc.doctype)) + "\" data-name=\"" + (escape(doc.name)) + "\">\n\t\t\t\t\t\t" + (__("Open")) + "\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t");
		}

		get_add_child_button(doc) {
			return ("\n\t\t\t\t<div class=\"level-item hidden-xs mr-3\">\n\t\t\t\t\t<button class=\"btn create-new btn-default btn-xs\"\n\t\t\t\t\t\tdata-name=\"" + (escape(doc.name)) + "\" data-project=\"" + (escape(doc.project)) + "\">\n\t\t\t\t\t\t" + (__("Add Child")) + "\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t");
		}

		render_header(columns, refresh_header) {
			if (refresh_header) {
				this.$result.find('.list-row-head').remove();
			}

			if (this.$result.find('.list-row-head').length === 0) {
				// append header once
				this.$result.prepend(this.get_header_html(columns));
			}
		}

		render_previous_button() {
			if (this.$result.find('.list-row-previous-head').length === 0) {
				// append header once
				this.$result.prepend(this.get_previous_header_html());
			}
		}

		remove_previous_button() {
			this.$result.find('.list-row-previous-head').remove();
		}

		get_header_html(columns) {
			var subject_field = columns[0].df;

			var subject_html = "\n\t\t\t<input class=\"level-item list-check-all hidden-xs\" type=\"checkbox\" title=\"" + (__("Select All")) + "\">\n\t\t\t<span class=\"level-item list-liked-by-me\">\n\t\t\t\t<i class=\"octicon octicon-heart text-extra-muted\" title=\"" + (__("Likes")) + "\"></i>\n\t\t\t</span>\n\t\t\t<span class=\"level-item\">" + (__(subject_field.label)) + "</span>\n\t\t";

			var $columns = columns.map(function (col) {
				var classes = [
					'list-row-col ellipsis',
					col.type == 'Subject' ? 'list-subject level' : 'hidden-xs',
					frappe.model.is_numeric_field(col.df) ? 'text-right' : ''
				].join(' ');

				return ("\n\t\t\t\t<div class=\"" + classes + "\">\n\t\t\t\t\t" + (col.type === 'Subject' ? subject_html : ("\n\t\t\t\t\t<span>" + (__(col.df && col.df.label || col.type)) + "</span>")) + "\n\t\t\t\t</div>\n\t\t\t");
			}).join('');

			return this.get_header_html_skeleton($columns, '<span class="list-count"></span>');
		}

		get_previous_header_html() {
			return ("\n\t\t\t<header class=\"level list-row list-row-head text-muted small\">\n\t\t\t\t<a class=\"btn btn-prev btn-xs\" style=\"margin-left: 15px;\">\n\t\t\t\t\t<svg class=\"icon  icon-sm\" style=\"\">\n\t\t\t\t\t\t<use class=\"mb-1\" href=\"#icon-left\"></use>\n\t\t\t\t\t</svg>\n\t\t\t\t\t<span style=\"margin-left: 5px\">Projects</span>\n\t\t\t\t</a>\n\t\t\t\t<button class=\"btn btn-xs expand-all btn-default\" style=\"float: right\">\n\t\t\t\t\t" + (__('Expand All')) + "</button>\n\t\t\t\t<button class=\"btn btn-xs collapse-all btn-default\" style=\"float: right; display: none\">\n\t\t\t\t\t" + (__('Collapse All')) + "</button>\n\t\t\t</header>\n\t\t");
		}

		on_row_checked() {
			this.$list_head_subject = this.$list_head_subject || this.$result.find('header .list-header-subject');
			this.$checkbox_actions = this.$checkbox_actions || this.$result.find('header .checkbox-actions');

			this.$checks = this.$result.find('.list-row-checkbox:checked');

			this.$list_head_subject.toggle(this.$checks.length === 0);
			this.$checkbox_actions.toggle(this.$checks.length > 0);

			if (this.$checks.length === 0) {
				this.$list_head_subject.find('.list-check-all').prop('checked', false);
			} else {
				this.$checkbox_actions.find('.list-header-meta').html(
					__('{0} items selected', [this.$checks.length])
				);
				this.$checkbox_actions.show();
				this.$list_head_subject.hide();
			}
		}

		get_checked_items(only_docnames) {
			var docnames = Array.from(this.$checks || [])
				.map(function (check) { return cstr(unescape($(check).data().name)); });

			if (only_docnames) { return docnames; }

			return this.data.filter(function (d) { return docnames.includes(d.name); });
		}

		get_header_html_skeleton(left, right) {
			if ( left === void 0 ) left = '';
			if ( right === void 0 ) right = '';

			return ("\n\t\t\t<header class=\"level list-row list-row-head text-muted small\">\n\t\t\t\t<div class=\"level-left list-header-subject\">\n\t\t\t\t\t" + left + "\n\t\t\t\t</div>\n\t\t\t\t<div class=\"level-left checkbox-actions\">\n\t\t\t\t\t<div class=\"level list-subject\">\n\t\t\t\t\t\t<input class=\"level-item list-check-all hidden-xs\" type=\"checkbox\" title=\"" + (__("Select All")) + "\">\n\t\t\t\t\t\t<span class=\"level-item list-header-meta\"></span>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"level-right\">\n\t\t\t\t\t" + right + "\n\t\t\t\t</div>\n\t\t\t</header>\n\t\t");
		}

		setup_check_events() {
			var this$1 = this;

			this.$result.on('change', 'input[type=checkbox]', function (e) {
				var $target = $(e.currentTarget);
				e.stopPropagation();

				if ($target.is('.list-header-subject .list-check-all')) {
					var $check = this$1.$result.find('.checkbox-actions .list-check-all');
					$check.prop('checked', $target.prop('checked'));
					$check.trigger('change');
				} else if ($target.is('.checkbox-actions .list-check-all')) {
					var $check$1 = this$1.$result.find('.list-header-subject .list-check-all');
					$check$1.prop('checked', $target.prop('checked'));

					this$1.$result.find('.list-row-checkbox')
						.prop('checked', $target.prop('checked'));
				}

				this$1.on_row_checked();
			});

			this.$result.on('click', '.list-row-checkbox', function (e) {
				var assign;

				var $target = $(e.currentTarget);
				e.stopPropagation();

				// shift select checkboxes
				if (e.shiftKey && this$1.$checkbox_cursor && !$target.is(this$1.$checkbox_cursor)) {
					var name_1 = this$1.$checkbox_cursor.data().name;
					var name_2 = $target.data().name;
					var index_1 = this$1.data.findIndex(function (d) { return d.name === name_1; });
					var index_2 = this$1.data.findIndex(function (d) { return d.name === name_2; });
					var ref = [index_1, index_2];
					var min_index = ref[0];
					var max_index = ref[1];

					if (min_index > max_index) {
						(assign = [max_index, min_index], min_index = assign[0], max_index = assign[1]);
					}

					var docnames = this$1.data.slice(min_index + 1, max_index).map(function (d) { return d.name; });
					var selector = docnames.map(function (name) { return (".list-row-checkbox[data-name=\"" + name + "\"]"); }).join(',');
					this$1.$result.find(selector).prop('checked', true);
				}

				this$1.$checkbox_cursor = $target;
			});
		}

		comment_when(datetime, mini) {
			var timestamp = frappe.datetime.str_to_user ?
				frappe.datetime.str_to_user(datetime) : datetime;
			return '<span class="frappe-timestamp '
				+ (mini ? " mini" : "") + '" data-timestamp="' + datetime
				+ '" title="' + timestamp + '">'
				+ this.prettyDate(datetime, mini) + '</span>';
		}

		convert_to_user_tz(date) {
			date = frappe.datetime.convert_to_user_tz(date);
			return new Date((date || "").replace(/-/g, "/").replace(/[TZ]/g, " ").replace(/\.[0-9]*/, ""));
		}

		prettyDate(date, mini) {
			if (!date) { return ''; }

			if (typeof (date) == "string") {
				date = this.convert_to_user_tz(date);
			}

			var diff = (((new Date()).getTime() - date.getTime()) / 1000);
			var day_diff = Math.floor(diff / 86400);

			if (isNaN(day_diff) || day_diff < 0) { return ''; }

			if (mini) {
				// Return short format of time difference
				if (day_diff == 0) {
					if (diff < 60) {
						return __("now");
					} else if (diff < 3600) {
						return __("{0} m", [Math.floor(diff / 60)]);
					} else if (diff < 86400) {
						return __("{0} h", [Math.floor(diff / 3600)]);
					}
				} else {
					if (day_diff < 7) {
						return __("{0} d", [day_diff]);
					} else if (day_diff < 31) {
						return __("{0} w", [Math.ceil(day_diff / 7)]);
					} else if (day_diff < 365) {
						return __("{0} M", [Math.ceil(day_diff / 30)]);
					} else {
						return __("{0} y", [Math.ceil(day_diff / 365)]);
					}
				}
			} else {
				// Return long format of time difference
				if (day_diff == 0) {
					if (diff < 60) {
						return __("just now");
					} else if (diff < 120) {
						return __("1 minute ago");
					} else if (diff < 3600) {
						return __("{0} minutes ago", [Math.floor(diff / 60)]);
					} else if (diff < 7200) {
						return __("1 hour ago");
					} else if (diff < 86400) {
						return __("{0} hours ago", [Math.floor(diff / 3600)]);
					}
				} else {
					if (day_diff == 1) {
						return __("yesterday");
					} else if (day_diff < 7) {
						return __("{0} days ago", [day_diff]);
					} else if (day_diff < 14) {
						return __("1 week ago");
					} else if (day_diff < 31) {
						return __("{0} weeks ago", [Math.ceil(day_diff / 7)]);
					} else if (day_diff < 62) {
						return __("1 month ago");
					} else if (day_diff < 365) {
						return __("{0} months ago", [Math.ceil(day_diff / 30)]);
					} else if (day_diff < 730) {
						return __("1 year ago");
					} else {
						return __("{0} years ago", [Math.ceil(day_diff / 365)]);
					}
				}
			}
		}
	};

	erpnext.projects.CustomFilterArea = class CustomFilterArea {

		constructor(list_view) {
			this.list_view = list_view;
			this.list_view.page.page_form.append("<div class=\"standard-filter-section flex\"></div>");

			var filter_area = this.list_view.hide_page_form
				? this.list_view.page.custom_actions
				: this.list_view.page.page_form;

			this.list_view.$filter_section = $('<div class="filter-section flex">').appendTo(
				filter_area
			);

			this.$filter_list_wrapper = this.list_view.$filter_section;
			this.trigger_refresh = true;
			this.setup();
		}

		setup() {
			if (!this.list_view.hide_page_form) { this.make_standard_filters(); }
			this.make_filter_list();
		}

		get() {
			var filters = this.filter_list.get_filters();
			var standard_filters = this.get_standard_filters();

			return filters.concat(standard_filters).uniqBy(JSON.stringify);
		}

		set(filters) {
			var this$1 = this;

			// use to method to set filters without triggering refresh
			this.trigger_refresh = false;
			return this.add(filters, false).then(function () {
				this$1.trigger_refresh = true;
				this$1.filter_list.update_filter_button();
			});
		}

		add(filters, refresh) {
			var this$1 = this;
			if ( refresh === void 0 ) refresh = true;

			if (!filters || (Array.isArray(filters) && filters.length === 0))
				{ return Promise.resolve(); }

			if (typeof filters[0] === "string") {
				// passed in the format of doctype, field, condition, value
				var filter = Array.from(arguments);
				filters = [filter];
			}

			filters = filters.filter(function (f) {
				return !this$1.exists(f);
			});

			var ref = this.set_standard_filter(
				filters
			);
			var non_standard_filters = ref.non_standard_filters;
			var promise = ref.promise;

			return promise
				.then(function () {
					return (
						non_standard_filters.length > 0 &&
						this$1.filter_list.add_filters(non_standard_filters)
					);
				})
				.then(function () {
					refresh && this$1.list_view.refresh();
				});
		}

		refresh_list_view_old() {
			if (this.trigger_refresh) {
				this.list_view.start = 0;
				this.list_view.refresh();
				this.list_view.on_filter_change();
			}
		}

		exists(f) {
			var exists = false;
			// check in standard filters
			var fields_dict = this.list_view.page.fields_dict;
			if (f[2] === "=" && f[1] in fields_dict) {
				var value = fields_dict[f[1]].get_value();
				if (value) {
					exists = true;
				}
			}

			// check in filter area
			if (!exists) {
				exists = this.filter_list.filter_exists(f);
			}

			return exists;
		}

		set_standard_filter(filters) {
			if (filters.length === 0) {
				return {
					non_standard_filters: [],
					promise: Promise.resolve(),
				};
			}

			var fields_dict = this.list_view.page.fields_dict;

			var out = filters.reduce(function (out, filter) {
				// eslint-disable-next-line
				var dt = filter[0];
				var fieldname = filter[1];
				var condition = filter[2];
				var value = filter[3];
				out.promise = out.promise || Promise.resolve();
				out.non_standard_filters = out.non_standard_filters || [];

				if (
					fields_dict[fieldname] &&
					(condition === "=" || condition === "like")
				) {
					// standard filter
					out.promise = out.promise.then(function () { return fields_dict[fieldname].set_value(value); }
					);
				} else {
					// filter out non standard filters
					out.non_standard_filters.push(filter);
				}
				return out;
			}, {});

			return out;
		}

		remove_filters(filters) {
			var this$1 = this;

			filters.map(function (f) {
				this$1.remove(f[1]);
			});
		}

		remove(fieldname) {
			var fields_dict = this.list_view.page.fields_dict;

			if (fieldname in fields_dict) {
				fields_dict[fieldname].set_value("");
			}

			var filter = this.filter_list.get_filter(fieldname);
			if (filter) { filter.remove(); }
			this.filter_list.apply();
			return Promise.resolve();
		}

		clear(refresh) {
			var this$1 = this;
			if ( refresh === void 0 ) refresh = true;

			if (!refresh) {
				this.trigger_refresh = false;
			}

			this.filter_list.clear_filters();

			var promises = [];
			var fields_dict = this.list_view.page.fields_dict;
			var loop = function ( key ) {
				var field = this$1.list_view.page.fields_dict[key];
				promises.push(function () { return field.set_value(""); });
			};

			for (var key in fields_dict) loop( key );
			return frappe.run_serially(promises).then(function () {
				this$1.trigger_refresh = true;
			});
		}

		make_standard_filters_old() {
			var this$1 = this;

			this.standard_filters_wrapper = this.list_view.page.page_form.find('.standard-filter-section');
			var fields = [
				{
					fieldtype: "Data",
					label: "Name",
					condition: "like",
					fieldname: "name",
					onchange: function () { return this$1.refresh_list_view(); },
				} ];

			if (this.list_view.custom_filter_configs) {
				this.list_view.custom_filter_configs.forEach(function (config) {
					config.onchange = function () { return this$1.refresh_list_view(); };
				});

				fields = fields.concat(this.list_view.custom_filter_configs);
			}

			var doctype_fields = this.list_view.meta.fields;
			var title_field = this.list_view.meta.title_field;

			fields = fields.concat(
				doctype_fields
					.filter(
						function (df) { return df.fieldname === title_field ||
							(df.in_standard_filter &&
								frappe.model.is_value_type(df.fieldtype)); }
					)
					.map(function (df) {
						var options = df.options;
						var condition = "=";
						var fieldtype = df.fieldtype;
						if (
							[
								"Text",
								"Small Text",
								"Text Editor",
								"HTML Editor",
								"Data",
								"Code",
								"Read Only" ].includes(fieldtype)
						) {
							fieldtype = "Data";
							condition = "like";
						}
						if (df.fieldtype == "Select" && df.options) {
							options = df.options.split("\n");
							if (options.length > 0 && options[0] != "") {
								options.unshift("");
								options = options.join("\n");
							}
						}
						var default_value =
							fieldtype === "Link"
								? frappe.defaults.get_user_default(options)
								: null;
						if (["__default", "__global"].includes(default_value)) {
							default_value = null;
						}
						return {
							fieldtype: fieldtype,
							label: __(df.label),
							options: options,
							fieldname: df.fieldname,
							condition: condition,
							default: default_value,
							onchange: function () { return this$1.refresh_list_view(); },
							ignore_link_validation: fieldtype === "Dynamic Link",
							is_filter: 1,
						};
					})
			);

			fields.map(function (df) {
				this$1.list_view.page.add_field(df, this$1.standard_filters_wrapper);
			});
		}

		get_standard_filters() {
			var filters = [];
			var fields_dict = this.list_view.page.fields_dict;
			for (var key in fields_dict) {
				var field = fields_dict[key];
				var value = field.get_value();
				if (value) {
					if (field.df.condition === "like" && !value.includes("%")) {
						value = "%" + value + "%";
					}
					filters.push([
						this.list_view.doctype,
						field.df.fieldname,
						field.df.condition || "=",
						value ]);
				}
			}

			return filters;
		}

		make_filter_list_old() {
			var this$1 = this;

			$(("<div class=\"filter-selector\">\n\t\t\t<button class=\"btn btn-default btn-sm filter-button\">\n\t\t\t\t<span class=\"filter-icon\">\n\t\t\t\t\t" + (frappe.utils.icon('filter')) + "\n\t\t\t\t</span>\n\t\t\t\t<span class=\"button-label hidden-xs\">\n\t\t\t\t\t" + (__("Filter")) + "\n\t\t\t\t<span>\n\t\t\t</button>\n\t\t</div>")
			).appendTo(this.$filter_list_wrapper);

			this.filter_button = this.$filter_list_wrapper.find('.filter-button');
			this.filter_list = new frappe.ui.FilterGroup({
				base_list: this.list_view,
				parent: this.$filter_list_wrapper,
				doctype: this.list_view.doctype,
				filter_button: this.filter_button,
				default_filters: [],
				on_change: function () { return this$1.refresh_list_view(); },
			});
		}

		is_being_edited() {
			// returns true if user is currently editing filters
			return (
				this.filter_list &&
				this.filter_list.wrapper &&
				this.filter_list.wrapper.find(".filter-box:visible").length > 0
			);
		}

		refresh_filters(meta) {
			this.list_view.page.clear_fields();
			this.list_view.current_doctype = meta.name;
			// this.$filter_list_wrapper.remove();

			var existing_list = $(this.list_view.parent).find(".filter-section");

			if (existing_list) {
				existing_list.remove();
			}

			this.list_view.doctype = meta.name;
			this.make_standard_filters(meta);

			var filter_area = this.list_view.hide_page_form
				? this.list_view.page.custom_actions
				: this.list_view.page.page_form;
			this.$filter_list_wrapper = $('<div class="filter-section flex">').appendTo(filter_area);
			this.make_filter_list(meta.name);
			this.clear(false);
		}

		make_standard_filters(meta) {
			var this$1 = this;

			if (!meta) {
				meta = this.list_view.meta;
			}

			var fields = [
				{
					fieldtype: 'Data',
					label: 'Name',
					condition: 'like',
					fieldname: 'name',
					onchange: function () { return this$1.refresh_list_view(); }
				}
			];

			var doctype_fields = meta.fields;
			var title_field = meta.title_field;

			fields = fields.concat(doctype_fields.filter(
				function (df) { return (df.fieldname === title_field) || (df.in_standard_filter && frappe.model.is_value_type(df.fieldtype)); }
			).map(function (df) {
				var options = df.options;
				var condition = '=';
				var fieldtype = df.fieldtype;
				if (['Text', 'Small Text', 'Text Editor', 'HTML Editor', 'Data', 'Code', 'Read Only'].includes(fieldtype)) {
					fieldtype = 'Data';
					condition = 'like';
				}
				if (df.fieldtype == "Select" && df.options) {
					options = df.options.split("\n");
					if (options.length > 0 && options[0] != "") {
						options.unshift("");
						options = options.join("\n");
					}
				}
				var default_value = (fieldtype === 'Link') ? frappe.defaults.get_user_default(options) : null;
				if (['__default', '__global'].includes(default_value)) {
					default_value = null;
				}
				return {
					fieldtype: fieldtype,
					label: __(df.label),
					options: options,
					fieldname: df.fieldname,
					condition: condition,
					default: default_value,
					onchange: function () { return this$1.refresh_list_view(); },
					ignore_link_validation: fieldtype === 'Dynamic Link',
					is_filter: 1,
				};
			}));

			this.standard_filters_wrapper = this.list_view.page.page_form.find('.standard-filter-section');
			if (this.standard_filters_wrapper.length == 0) {
				this.list_view.page.page_form.append("<div class=\"standard-filter-section flex\"></div>");
				this.standard_filters_wrapper = this.list_view.page.page_form.find('.standard-filter-section');
			}
			fields.map(function (df) {
				this$1.list_view.page.add_field(df, this$1.standard_filters_wrapper);
			});
		}

		make_filter_list(doctype) {
			var this$1 = this;

			if (!doctype) {
				doctype = this.list_view.doctype;
			}

			$(("<div class=\"filter-selector\">\n\t\t\t<button class=\"btn btn-default btn-sm filter-button\">\n\t\t\t\t<span class=\"filter-icon\">\n\t\t\t\t\t" + (frappe.utils.icon('filter')) + "\n\t\t\t\t</span>\n\t\t\t\t<span class=\"button-label hidden-xs\">\n\t\t\t\t\t" + (__("Filter")) + "\n\t\t\t\t<span>\n\t\t\t</button>\n\t\t</div>")
			).appendTo(this.$filter_list_wrapper);
			
			this.filter_button = this.$filter_list_wrapper.find('.filter-button');
			this.filter_list = new frappe.ui.FilterGroup({
				base_list: this.list_view,
				parent: this.$filter_list_wrapper,
				doctype: doctype,
				default_filters: [],
				filter_button: this.filter_button,
				on_change: function () { return this$1.refresh_list_view(); }
			});
		}

		refresh_list_view() {
			if (this.trigger_refresh) {
				if (this.list_view.doctype == "Task") {
					this.list_view.fetch_tasks();
					return;
				}

				this.list_view.start = 0;
				this.list_view.refresh();
				this.list_view.on_filter_change();
			}
		}
	};

}());
//# sourceMappingURL=cloud_extel.js.map
