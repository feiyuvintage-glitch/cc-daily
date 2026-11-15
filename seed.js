// 测试数据（占位，非真实数据）
const SEED_CUSTOMERS=['王芳','王方','李娜','李华','张伟','张薇','刘洋','陈静','杨丽','赵敏','黄蕾','周杰','吴倩','林琳','Amy','Lily Chen','孙悦','马丽','朱婷','胡蝶'];
function seedAll(){localStorage.removeItem(DBKEY);const t=NOW();const d=n=>addDays(today(),n);
 Funds.addAccount({name:'招行人民币',currency:'CNY',opening:200000});Funds.addAccount({name:'三井住友日元',currency:'JPY',opening:3000000});Funds.addAccount({name:'现金日元',currency:'JPY',opening:150000});Funds.addAccount({name:'旧日元户',currency:'JPY',opening:0});
 const inv=[['CS-244','BVLGARI','Serpenti 手镯','18K玫瑰金',12.4,38000,52000],['CS-245','Cartier','Love 戒指','18K黄金',5.1,9000,14800],['CS-246','VCA','四叶草项链','18K黄金',6.0,15000,22800],['CS-247','BVLGARI','B.zero1 戒指','待补',null,7000,11800],['CS-248','Cartier','Juste un Clou 手链','18K白金',14.2,30000,45000],['CS-249','VCA','Alhambra 耳钉','18K黄金',3.2,0,16800],['CS-2440','BVLGARI','Serpenti 项链','18K黄金',18.0,26000,39800],['CS-250','Cartier','Trinity 戒指','18K三色金',5.5,6800,10800]];
 for(const [code,brand,name,mat,w,cost,price] of inv)Inv.add({code,brand,name,params:{material:mat,weight_g:w},cost,price});
 const db0=load();Inv.update(db0.inv.find(i=>i.code==='CS-248').id,{loaned_to:'小林'});Inv.sendRepair(load().inv.find(i=>i.code==='CS-250').id,'factory',d(-40),'');
 HJ.add('jm',{name:'Alhambra 耳钉（寄）',category:'耳饰',description:'18K黄金',amount:16000,inv_code:'CS-249',start_date:d(-50),return_due:d(-5)});
 HJ.add('jm',{name:'Tank 手表',category:'手表',description:'钢',amount:21000,start_date:d(-10),return_due:d(40)});
 HJ.add('jm',{name:'Panthère 胸针',category:'胸针',description:'18K',amount:18000});
 HJ.add('hg',{name:'Serpenti Viper 手链',category:'手链',description:'18K',amount:20000});
 HJ.add('hg',{name:'Juste un Clou 戒指',category:'戒指',description:'18K',amount:8000,salePrice:12000});
 { const db=load();HJ.returnToOwner(db.hj.find(h=>h.name==='Panthère 胸针').id,d(-2)); }
 SalesMirror.refresh();
 // 历史销售（无绑定，无收款挂账户）
 let k=100;for(let i=0;i<SEED_CUSTOMERS.length;i++){const c=SEED_CUSTOMERS[i];Sales.createBatch({customer:c,saleDate:d(-60+i*2)},[{code:'H-'+(k++),brand:['BVLGARI','Cartier','VCA'][i%3],name:'历史单 '+i,specs:'18K / 附盒',listPrice:12000+i*100,price:11000+i*100,cost:7000}]);}
 const s0=load().sales.find(s=>s.code==='H-100');Pay.add(s0.id,{date:d(-50),cny:5000,method:'转账'}); // 历史收款，不挂账户
 // 费用
 Exp.add({scope:'company',date:d(-20),category:'办公',item:'打印纸',payee:'某文具店',amount:3300,account_id:2});
 tx(db=>{db.expenses[0].receipt={file_name:'r1.pdf',kind:'pdf',label:'发票'};});
 Exp.add({scope:'personal',date:d(-10),category:'其他',item:'午餐',payee:'某餐厅',amount:1200,account_id:''});
 tx(db=>{db.expenses.push({id:nextId(db,'exp'),scope:'company',date:d(-90),category:'会计服务费',item:'历史费用（无账户）',payee:'某会计所',amount:55000,period:'',note:'',status:'确认',deleted_at:null,created_at:t,flow_id:null,account_id:null,receipt:null,receipt_exempt:true});});
 Funds.addRule({name:'办公室房租',day:Number(today().slice(8))+2>28?28:Number(today().slice(8))+2,amount:120000});Funds.addRule({name:'网络费',day:1,amount:5500});
 Funds.addDebt({dir:'borrow',person:'老周',currency:'JPY',amount:300000,due:d(-35)});
 // 其他空间
 tx(db=>{db.metrics.push({key:'total',value:1834});db.catalogues.push({id:nextId(db,'cat'),title:'某拍卖行 香港 珠宝专场',house:'某拍卖行',location:'香港',sale_date:d(5),kind:'official',version:'preview',pdf:true,pages:12,created_at:t},{id:nextId(db,'cat'),title:'某拍卖行 日内瓦 春拍',house:'某拍卖行',location:'日内瓦',sale_date:d(11),kind:'official',version:'preview',pdf:true,pages:30,created_at:t},{id:nextId(db,'cat'),title:'自制 BVLGARI 图册',house:'',location:'',sale_date:d(-100),kind:'self',version:'result',pdf:false,pages:0,created_at:t});
  db.samples.push({id:nextId(db,'smp'),code:'BV-001',brand:'bulgari',verdict:'真',category:'戒指 18K',hallmark:'BVLGARI 750 Made in Italy',metalMark:'750',serial:'',sampleDate:d(-30)},{id:nextId(db,'smp'),code:'BV-002',brand:'bulgari',verdict:'假',category:'戒指 18K',hallmark:'BULGARI 750',metalMark:'750',serial:'',sampleDate:d(-20)},{id:nextId(db,'smp'),code:'CA-001',brand:'cartier',verdict:'真',category:'手镯',hallmark:'Cartier 750 AU 1234',metalMark:'750',serial:'AB1234',sampleDate:d(-15)});
  db.sample_versions.push({published_at:d(-1),pages:24,samples:3});db.brand_rules.push({brand:'bulgari',genuine:'字体工整',fake:'字距不均',pending:'旧款刻印'});
  db.cities.push({id:1,name:'香港',code:'HKG',lat:22.3},{id:2,name:'日内瓦',code:'GVA',lat:46.2});db.seq.city=2;
  db.trips.push({id:nextId(db,'trip'),cityId:1,startDate:d(4),endDate:d(7),purpose:'预展',flights:[{flightNo:'NH859',departPlace:'HND',arrivePlace:'HKG',departDate:d(4),departTime:'09:30',arriveDate:d(4),arriveTime:'13:30',pnr:'ABC123'}]},{id:nextId(db,'trip'),cityId:2,startDate:d(-60),endDate:d(-55),purpose:'春拍',flights:[]});
  db.members.push({id:1,name:'成员1',relation:'本人',detail:''},{id:2,name:'成员2',relation:'子女',detail:''});db.seq.mem=2;
  db.records.push({id:nextId(db,'rec'),member_id:1,kind:'appointment',title:'年度复查',date:d(-3),time_hm:'10:00',done:false},{id:nextId(db,'rec'),member_id:2,kind:'appointment',title:'牙科',date:d(2),time_hm:'15:00',done:false},{id:nextId(db,'rec'),member_id:2,kind:'vaccine',title:'流感疫苗',date:d(-200),next_date:d(-10),done:true,done_at:d(-200)});
  db.family.push({id:nextId(db,'fam'),title:'家长会',category:'school',member:'家长',start_date:d(1),source:'manual'},{id:nextId(db,'fam'),title:'周末出游',category:'trip',member:'全家',start_date:d(40),source:'manual'});
  db.works.push({id:nextId(db,'work'),title:'海边的小屋',author:'a',workDate:d(-3),kind:'绘画',photos:3,favorite:true},{id:nextId(db,'work'),title:'恐龙',author:'b',workDate:d(-5),kind:'黏土',photos:1,favorite:false});
  db.docs.push({id:nextId(db,'doc'),category:'证件',holder:'家长',name:'护照',expiryDate:d(120),renewWindowDays:365},{id:nextId(db,'doc'),category:'证件',holder:'孩子',name:'在留卡',expiryDate:d(-4),renewWindowDays:90},{id:nextId(db,'doc'),category:'订阅',holder:'全家',name:'宽带合约',noExpiry:true,renewWindowDays:90},{id:nextId(db,'doc'),category:'保险',holder:'家长',name:'地震保险',expiryDate:'',renewWindowDays:90});});
 localStorage.setItem(OFFKEY,'0');}
