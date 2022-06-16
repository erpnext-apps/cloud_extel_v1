# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from erpnext.accounts.report.financial_statements import filter_accounts
from erpnext.accounts.utils import get_account_balances

def execute(filters=None):
	columns = get_columns(filters)
	data = get_data(filters)

	return columns, data

def get_columns(filters):
	return [
		{
			"fieldname": "value",
			"label": _("Account"),
			"fieldtype": "Link",
			"options": "Account",
			"width": 300,
		},
		{
			"fieldname": "amount",
			"label": _("Amount"),
			"fieldtype": "Data",
			"width": 300,
		},
		{
			"fieldname": "account_currency",
			"label": _("Currency"),
			"fieldtype": "Link",
			"options": "Currency",
			"hidden": 1,
		},
	]

def get_data(filters):
	report_filters = {}
	for field in ["name", "company"]:
		if filters.get(field):
			report_filters[field] = filters.get(field)

	accounts = frappe.get_all(
		"Account",
		filters = report_filters,
		fields = ["name", "name as value", "account_number",
			"parent_account", "account_name", "account_currency"]
	)

	accounts = filter_accounts(accounts)[0]
	accounts = get_account_balances(accounts, filters.get("company"))

	for account in accounts:
		account["amount"] = account.get("balance_in_account_currency") or account.get("balance")

	return accounts
