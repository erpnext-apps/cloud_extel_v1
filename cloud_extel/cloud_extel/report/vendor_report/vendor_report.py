from __future__ import unicode_literals
from frappe.model.document import Document
import frappe
from frappe.utils import (add_days, getdate, formatdate, date_diff,
	add_years, get_timestamp, nowdate, flt, cstr, add_months, get_last_day, cint)
from frappe import _

def execute(filters=None):
	columns, data = get_columns(), get_data(filters)
	return columns, data

def get_columns():
	print("get_columns")
	return[
		_("Supplier") + ":Data:150",
		_("Cost Centre") + ":Data:150",
		_("Telecom Circle") + ":Data:150",
		_("PO Status") + ":Data:150",
		_("PO Date") + ":Date:100",
		_("PO Required By") + ":Date:100",
		_("Purchase Order Number") + "Link/Purchase Order:150",
		_("PO Qty") + ":Data:230",
		_("PO Amt") + ":Data:130",
		_("GRN Number") + "Link/Purchase Receipt:150",
		_("GRN Dated") + ":Date:100",
		_("Received Qty") + ":Data:140",
		_("Pending Excess / ShortageQty") + ":Data:100",
		_("Received Amount") + ":Data:150",
		_("Pending Amt") + ":Data:150",
		_("GRN Status") + ":Data:120",
		_("Purchase Invoice number") + "Link/Purchase Order:150",
		_("Purchase Invoice ERP Date") + ":Date:100",
		_("Supplier No") + "Link/Supplier:150",
		_("Supplier Inv Date") + ":Date:100",
		_("Inv Billed Qty") + ":Data:150",
		_("Pending Qty to Bill") + ":Data:150",
		_("Grand Total") + ":Data:120",
		_("PI Status") + ":Data:100",
		_("Input SGST") + ":Data:160",
		_("Input CGST") + ":Data:100",
		_("Input IGST") + ":Data:100",
		_("TDS Category") + ":Data:100",
		_("TDS Amt") + ":Data:100",
		_("TCS") + ":Data:100",
		_("Tax Amount") + ":Data:100",
		_("Due Date") + ":Date:100",
		_("Payment Status") + ":Data:180",
		_("Payment Date") + ":Date:100",
		_("Refernce Number") + ":Data:200",
		_("Company") + ":Data:200",
	]	

def get_data(filters=None):
	print("get_data")
	data=[]
	purchase_invoice_list=frappe.get_all("Purchase Invoice")
	for purchase_invoice in purchase_invoice_list:
		is_inclusive_tax = False
		purchase_invoice_doc = frappe.get_doc("Purchase Invoice",purchase_invoice.name)
		pe = frappe.get_all('Payment Entry','party')
		for item in purchase_invoice_doc.items:
			if item.purchase_receipt:
				pr = frappe.get_doc("Purchase Receipt", item.purchase_receipt)
			else:
				pr = ""	
			supplier = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'supplier') or ""
			cost_centre = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'cost_center') or ""
			telecom_circle = ""
			po_status = frappe.db.get_value("Purchase Order", item.purchase_order,'status') or ""
			date = frappe.db.get_value("Purchase Order", item.purchase_order,'transaction_date') or ""
			required_by = frappe.db.get_value("Purchase Order", item.purchase_order,'schedule_date') or ""
			purchase_order_number = item.purchase_order if item.purchase_order else ""
			qty = frappe.db.get_value("Purchase Order", item.purchase_order,'total_qty') or 0
			po_amt = frappe.db.get_value("Purchase Order", item.purchase_order,'total') or 0
			grn_no = pr.name if pr else ""
			grn_dated = pr.posting_date if pr else ""
			received_qty = pr.total_qty if pr else ""
			shortage_qty = qty - pr.total_qty if pr else ""
			received_amt = pr.total if pr else ""
			pending_amt = po_amt - pr.total if pr else ""
			grn_status = pr.status if pr else ""
			purchase_invoice_no = purchase_invoice_doc.name if purchase_invoice_doc.name else ""
			purchase_invoice_date = purchase_invoice_doc.posting_date if purchase_invoice_doc.posting_date else ""
			supplier_no = purchase_invoice_doc.bill_no if purchase_invoice_doc.bill_no else ""
			supplier_invoice_date = purchase_invoice_doc.bill_date if purchase_invoice_doc.bill_date else ""
			inv_billed_qty = purchase_invoice_doc.total_qty if purchase_invoice_doc.total_qty else ""
			pending_qty = purchase_invoice_doc.total_qty - qty if purchase_invoice_doc.total_qty else ""
			grand_total = purchase_invoice_doc.grand_total if purchase_invoice_doc.grand_total else ""
			status = purchase_invoice_doc.status if purchase_invoice_doc.status else ""
			input_sgst = ""
			input_cgst = ""
			input_igst = ""
			tds_category = purchase_invoice_doc.tax_withholding_category if purchase_invoice_doc.tax_withholding_category else ""
			tds_amount	= get_tds_amount_from_purchase_taxes_and_charges(purchase_invoice_doc.name) if purchase_invoice_doc.name else ""
			tds_name = purchase_invoice_doc.tax_withholding_category if purchase_invoice_doc.tax_withholding_category else ""
			tsc = ""
			tax_amount = get_tax_amount_from_taxes_and_charges(purchase_invoice_doc.name) if purchase_invoice_doc.name else ""
			due_date = purchase_invoice_doc.due_date if purchase_invoice_doc.due_date else ""
			payment_status = purchase_invoice_doc.status if purchase_invoice_doc.status else ""
			if len(pe) >=1:
				for i in pe:
					if i['party'] == purchase_invoice_doc.supplier:
						pymt_date = frappe.db.get_value('Payment Entry',{'party_type': 'Supplier','party':purchase_invoice_doc.supplier},'reference_date') or ""
						reference_no = frappe.db.get_value('Payment Entry',{'party_type': 'Supplier','party':purchase_invoice_doc.supplier},'reference_no') or ""
					else:
						pymt_date = ""
						reference_no = ""
					
			else:
				pymt_date = ""
				reference_no = ""
			company = pr.company if pr else ""
			row = [
					supplier,
					cost_centre,
					telecom_circle,
					po_status,
					date,
					required_by,
					purchase_order_number,
					qty,
					po_amt,
					grn_no,
					grn_dated,
					received_qty,
					shortage_qty,
					received_amt,
					pending_amt,
					grn_status,
					purchase_invoice_no,
					purchase_invoice_date,
					supplier_no,
					supplier_invoice_date,
					inv_billed_qty,
					pending_qty,
					grand_total,
					status,
					input_sgst,
					input_cgst,
					input_igst,
					tds_category,
					tds_amount,
					tsc,
					tax_amount,
					due_date,
					payment_status,
					pymt_date,
					reference_no,
					company
			]
			data.append(row)
	return data

def get_tds_amount_from_purchase_taxes_and_charges(purchase_invoice):
	tds_amount = ""
	purchase_invoice_doc = frappe.get_doc("Purchase Invoice", purchase_invoice)
	for item in purchase_invoice_doc.taxes:
 		tds_amount = item.tax_amount
	return tds_amount

def get_tax_amount_from_taxes_and_charges(purchase_invoice):
	tax_amount = ""
	purchase_invoice_doc = frappe.get_doc("Purchase Invoice", purchase_invoice)
	for item in purchase_invoice_doc.taxes:
 		tax_amount = item.tax_amount
	return tax_amount		

	