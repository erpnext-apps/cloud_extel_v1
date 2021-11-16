frappe.provide('frappe.views');
frappe.provide("erpnext.projects");

frappe.pages['project-treeview'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Project Tree',
		single_column: true
	});

	frappe.require('assets/cloud_extel/js/cloud_extel.js', () => {
		frappe.model.with_doctype("Project", () => {
			frappe.model.with_doctype("Task", () => {
				new erpnext.projects.ProjectTree({
					doctype: "Project",
					parent: wrapper,
					page: page
				});
			});
		});
	});

};