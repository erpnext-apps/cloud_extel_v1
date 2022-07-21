// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Vendor Report"] = {
	"filters": [
		{
            fieldname: 'company',
            label: __('Company'),
            fieldtype: 'Link',
            options: 'Company',
            default: frappe.defaults.get_user_default('company')
        },
		{
            fieldname: 'purchase_order_number',
            label: __('Purchase Order Number'),
            fieldtype: 'Link',
            options: 'Purchase Order',
        },
		{
            fieldname: 'grn_no',
            label: __('GRN Number'),
            fieldtype: 'Link',
            options: 'Purchase Receipt',
        },
        {
            fieldname: 'purchase_invoice_no',
            label: __('Purchase Invoice number'),
            fieldtype: 'Link',
            options: 'Purchase Invoice',
        },
		{
            fieldname: 'supplier_no',
            label: __('Supplier No'),
            fieldtype: 'Link',
            options: 'Supplier',
        },
		

	]
};
