// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Chart of Account Report"] = {
	"filters": [
		{
			"fieldname": "company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default": frappe.defaults.get_user_default("Company"),
			"reqd": 1
		},
		{
			"fieldname": "name",
			"label": __("Account"),
			"fieldtype": "Link",
			"options": "Account",
			"get_query": function() {
				let company = frappe.query_report.get_filter_value('company');
				return {
					filters: {
						company: company
					}
				}
			}
		},
	],
	"tree": true,
	"name_field": "account",
	"parent_field": "parent_account",
	"initial_depth": 3,
	"formatter": function(value, row, column, data, default_formatter) {
		if (column.fieldname == "amount" && data) {
			let dr_or_cr = data.amount > 0 ? "Dr": "Cr";
			value = format_currency(Math.abs(data.amount), data.account_currency) + ' ' + dr_or_cr;
		}

		return value;
	},
}