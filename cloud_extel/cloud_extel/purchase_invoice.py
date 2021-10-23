from __future__ import unicode_literals
import frappe
from frappe.utils import cint, flt
from erpnext.accounts.general_ledger import make_gl_entries
from erpnext.accounts.utils import get_account_currency

def make_purchase_invoice_gl_entries(doc, method):
	auto_accounting_for_non_stock_items = cint(frappe.db.get_value('Company', doc.company, 'enable_perpetual_inventory_for_non_stock_items'))
	service_received_but_not_billed_account = doc.get_company_default("service_received_but_not_billed")
	
	if auto_accounting_for_non_stock_items:

		gl_entries = []
		expense_account_map = get_expense_account_map(doc)

		for item in doc.get("items"):
			if item.purchase_receipt:
				# Post reverse entry for Stock-Received-But-Not-Billed if it is booked in Purchase Receipt
				expense_booked_in_pr = frappe.db.get_value('GL Entry', {'is_cancelled': 0,
					'voucher_type': 'Purchase Receipt', 'voucher_no': item.purchase_receipt, 'voucher_detail_no': item.pr_detail,
					'account':service_received_but_not_billed_account}, ['name'], as_dict=1)

				if expense_booked_in_pr:
					account_currency = get_account_currency(expense_booked_in_pr.account)
					expense_account = expense_account_map.get(item.pr_detail)
					amount = flt(item.base_net_amount + item.item_tax_amount, item.precision("base_net_amount"))
					gl_entries.append(doc.get_gl_dict({
						"account": expense_account,
						"against": doc.credit_to,
						"debit": amount,
						"cost_center": item.cost_center,
						"project": item.project or doc.project
					}, account_currency, item=item))

					gl_entries.append(doc.get_gl_dict({
						"account": expense_account,
						"against": item.expense_account,
						"credit": amount,
						"cost_center": item.cost_center,
						"project": item.project or doc.project
					}, account_currency, item=item))

		make_gl_entries(gl_entries, merge_entries=False)


def get_expense_account_map(purchase_document):
	purchase_receipts = []
	for d in purchase_document.get('items'):
		if d.get('purchase_receipt'):
			purchase_receipts.append(d.purchase_receipt)
	
	return frappe._dict(frappe.get_all('Purchase Receipt Item', filters={'parent': ('in', purchase_receipts)},
		fields=['name', 'expense_account'], as_list=1))