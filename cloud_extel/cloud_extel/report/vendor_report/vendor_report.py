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
	purchase_invoice_list=frappe.get_all("Purchase Invoice",filters=[['status','!=','Draft']])
	for purchase_invoice in purchase_invoice_list:
		is_inclusive_tax = False
		supplier = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'supplier') or ""
		pe = frappe.get_all('Payment Entry','party',{'party_type': 'Supplier','party':supplier})
		cost_centre = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'cost_center') or ""
		telecom_circle = ""
		po_status = frappe.db.sql("select status from `tabPurchase Order` po join `tabPurchase Invoice Item` pii on pii.purchase_order=po.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if po_status:
			po_status = po_status[0]['status']
		else:
			po_status=''
		date = frappe.db.sql("select transaction_date from `tabPurchase Order` po join `tabPurchase Invoice Item` pii on pii.purchase_order=po.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if date:
			date = date[0]['transaction_date']
		else:
			date=''
		required_by = frappe.db.sql("select schedule_date from `tabPurchase Order` po join `tabPurchase Invoice Item` pii on pii.purchase_order=po.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if required_by:
			required_by = required_by[0]['schedule_date']
		else:
			required_by=''
		purchase_order_number = frappe.db.sql("select po.name from `tabPurchase Order` po join `tabPurchase Invoice Item` pii on pii.purchase_order=po.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if purchase_order_number:
			purchase_order_number = purchase_order_number[0]['name']
		else:
			purchase_order_number=''
		qty = frappe.db.sql("select total_qty from `tabPurchase Order` po join `tabPurchase Invoice Item` pii on pii.purchase_order=po.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or 0
		if qty:
			qty = qty[0]['total_qty']
		else:
			qty= 0
		po_amt = frappe.db.sql("select total from `tabPurchase Order` po join `tabPurchase Invoice Item` pii on pii.purchase_order=po.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or 0
		if po_amt:
			po_amt = po_amt[0]['total']
		else:
			po_amt=0 
		grn_no = frappe.db.sql("select pr.name from `tabPurchase Receipt` pr join `tabPurchase Invoice Item` pii on pii.purchase_receipt=pr.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if grn_no:
			grn_no = grn_no[0]['name']
		else:
			grn_no=''
		grn_dated = frappe.db.sql("select pr.posting_date from `tabPurchase Receipt` pr join `tabPurchase Invoice Item` pii on pii.purchase_receipt=pr.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if grn_dated:
			grn_dated = grn_dated[0]['posting_date']
		else:
			grn_dated=''
		received_qty = frappe.db.sql("select pr.total_qty from `tabPurchase Receipt` pr join `tabPurchase Invoice Item` pii on pii.purchase_receipt=pr.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if received_qty:
			received_qty = received_qty[0]['total_qty']
		else:
			received_qty=0
		shortage_qty = qty - received_qty or 0
		received_amt = frappe.db.sql("select pr.total from `tabPurchase Receipt` pr join `tabPurchase Invoice Item` pii on pii.purchase_receipt=pr.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		print('RRRRECEIVED AMOUNT',received_amt)
		if received_amt:
			received_amt = received_amt[0]['total']
		else:
			received_amt=0
		pending_amt = po_amt - received_amt or ""
		grn_status = frappe.db.sql("select pr.status from `tabPurchase Receipt` pr join `tabPurchase Invoice Item` pii on pii.purchase_receipt=pr.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if grn_status:
			grn_status = grn_status[0]['status']
		else:
			grn_status=''
		purchase_invoice_no = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'name') or ""
		purchase_invoice_date = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'posting_date') or ""
		supplier_no = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'bill_no') or ""
		supplier_invoice_date = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'bill_date') or ""
		inv_billed_qty = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'total_qty') or 0
		pending_qty = inv_billed_qty - qty or ""
		grand_total = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'grand_total') or 0
		status = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'status') or ''
		tds_category = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'tax_withholding_category') or ''
		tds_amount	= get_tds_amount_from_purchase_taxes_and_charges(purchase_invoice_no) if purchase_invoice_no else ""
		tds_name = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'tax_withholding_category') or ''
		tax_amount = get_tax_amount_from_taxes_and_charges(purchase_invoice_no) if purchase_invoice_no else ""
		due_date = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'due_date') or ''
		payment_status = frappe.db.get_value("Purchase Invoice",purchase_invoice.name,'status') or ''
		if len(pe) >=1:
			for i in pe:
				pymt_date = frappe.db.get_value('Payment Entry',{'party_type': 'Supplier','party':supplier},'reference_date') or ""
				reference_no = frappe.db.get_value('Payment Entry',{'party_type': 'Supplier','party':supplier},'reference_no') or ""
		else:
			pymt_date = ""
			reference_no = ""
		company = frappe.db.sql("select pr.company from `tabPurchase Receipt` pr join `tabPurchase Invoice Item` pii on pii.purchase_receipt=pr.name and pii.parent= %(pi)s",{'pi':purchase_invoice.name},as_dict=1) or ''
		if company:
			company = company[0]['company']
		else:
			company=''
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
				'',
				'',
				'',
				tds_category,
				tds_amount,
				'',
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

	