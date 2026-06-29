import { Report } from "../types/report";

export const mockReports: Report[] = [

{
id:"1",

trackingCode:"140500001",

department:"فناوری اطلاعات",

requestType:"پشتیبانی نرم افزار",

requester:"مائده شعیب",

createdAt:"1405/04/06",

updatedAt:"1405/04/06",

status:"جدید",

fields:{

موضوع:"مشکل VPN",

شرح:"از صبح اتصال برقرار نیست",

اولویت:"زیاد"

}

},

{

id:"2",

trackingCode:"140500002",

department:"منابع انسانی",

requestType:"درخواست مرخصی",

requester:"علی احمدی",

createdAt:"1405/04/07",

updatedAt:"1405/04/07",

status:"تکمیل شده",

fields:{

موضوع:"مرخصی",

روز:"2"

}

}

];