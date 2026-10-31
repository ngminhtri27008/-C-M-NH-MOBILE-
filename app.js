// 1) Thay CONFIG bằng thông tin ứng dụng Firebase của bạn.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "DAN_API_KEY_CUA_BAN",
  authDomain: "TEN_DU_AN.firebaseapp.com",
  projectId: "TEN_DU_AN",
  storageBucket: "TEN_DU_AN.appspot.com",
  messagingSenderId: "DAN_MESSAGING_SENDER_ID",
  appId: "DAN_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const staffApp = initializeApp(firebaseConfig, "staffCreator");
const staffAuth = getAuth(staffApp);

const BRANDS = ["iPhone","Samsung","Vivo","OPPO","Realme","Redmi"];
const ISSUES = ["Thay màn hình","Thay pin","Thay camera","Thay chân sạc","Thay loa","Thay nút nguồn / âm lượng","Hư Face ID","Mất nguồn"];
let products = [], selectedBrand = "", selectedProduct = null, currentRole = null;
const $ = id => document.getElementById(id);
const money = v => Number(v||0).toLocaleString("vi-VN") + " đ";
const toast = msg => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),3000); };

$("year").textContent = new Date().getFullYear();
$("newBrand").innerHTML = BRANDS.map(b=>`<option>${b}</option>`).join("");

function renderBrands(){
  $("brands").innerHTML = BRANDS.map(b=>`<button class="brand-button ${selectedBrand===b?"active":""}" data-brand="${b}">${b}<span>Chọn thương hiệu</span></button>`).join("");
  document.querySelectorAll("[data-brand]").forEach(el=>el.onclick=()=>{selectedBrand=el.dataset.brand;renderBrands();renderModels();});
}
function renderModels(){
  const q=$("search").value.trim().toLowerCase();
  const list=products.filter(p=>(!selectedBrand||p.brand===selectedBrand)&&(!q||(p.model||"").toLowerCase().includes(q)||(p.brand||"").toLowerCase().includes(q)));
  $("productCount").textContent=products.length+" dòng máy";
  $("models").innerHTML=list.length?list.map(p=>`<button class="model-button ${selectedProduct?.id===p.id?"active":""}" data-product="${p.id}">${escapeHtml(p.model)} <span aria-hidden="true">›</span></button>`).join(""):'<p class="muted">Chưa có dòng máy phù hợp. Quản trị viên có thể thêm model.</p>';
  document.querySelectorAll("[data-product]").forEach(el=>el.onclick=()=>showPrices(el.dataset.product));
}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showPrices(id){
  selectedProduct=products.find(p=>p.id===id); if(!selectedProduct)return;
  $("selectedTitle").textContent=selectedProduct.brand+" "+selectedProduct.model;
  $("priceRows").innerHTML=ISSUES.map(issue=>`<tr><td>${issue}</td><td>${selectedProduct.prices?.[issue]?money(selectedProduct.prices[issue]):"Liên hệ"}</td></tr>`).join("");
  $("priceSection").classList.remove("hidden"); renderModels();
}
async function loadProducts(){
  try{
    const snap=await getDocs(collection(db,"products"));
    products=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.brand+a.model).localeCompare(b.brand+b.model,"vi"));
    renderBrands();renderModels();
    if(selectedProduct){const fresh=products.find(p=>p.id===selectedProduct.id);if(fresh)showPrices(fresh.id);}
  }catch(e){console.error(e);toast("Chưa kết nối được dữ liệu. Kiểm tra cấu hình Firebase.");}
}
$("search").addEventListener("input",()=>{selectedBrand="";renderBrands();renderModels();});
$("loginOpen").onclick=()=>$("loginModal").classList.remove("hidden");
$("loginClose").onclick=()=>$("loginModal").classList.add("hidden");
$("login").onclick=async()=>{
  $("loginError").textContent="";
  try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);$("loginModal").classList.add("hidden");$("password").value="";}
  catch(e){$("loginError").textContent="Không đăng nhập được. Hãy kiểm tra email, mật khẩu và cấu hình Firebase.";}
};
$("logout").onclick=()=>signOut(auth);

auth.onAuthStateChanged(async user=>{
  $("adminPanel").classList.add("hidden");$("loginOpen").textContent="Quản trị";currentRole=null;
  if(!user)return;
  try{
    const snap=await getDoc(doc(db,"users",user.uid));
    if(!snap.exists()||!["admin","staff"].includes(snap.data().role)){await signOut(auth);toast("Tài khoản chưa được cấp quyền.");return;}
    currentRole=snap.data().role;
    $("adminPanel").classList.remove("hidden");$("loginOpen").textContent="Đang đăng nhập";
    $("whoami").textContent=user.email+" · "+(currentRole==="admin"?"Quản trị viên":"Nhân viên được phân quyền");
    $("adminTools").classList.toggle("hidden",currentRole!=="admin");
    fillEditModels();
  }catch(e){console.error(e);toast("Không đọc được quyền tài khoản.");}
});
function fillEditModels(){
  $("editModel").innerHTML=products.map(p=>`<option value="${p.id}">${escapeHtml(p.brand+" "+p.model)}</option>`).join("");
  renderEditor();
}
$("editModel").onchange=renderEditor;
function renderEditor(){
  const p=products.find(x=>x.id===$("editModel").value);
  $("editPrices").innerHTML=p?ISSUES.map((issue,i)=>`<div class="price-item"><label>${issue}<input type="number" min="0" step="1000" data-issue="${i}" value="${Number(p.prices?.[issue]||0)}" placeholder="Nhập giá (0 = chưa báo giá)"></label></div>`).join(""):"<p>Chưa có dòng máy.</p>";
}
$("savePrices").onclick=async()=>{
  const p=products.find(x=>x.id===$("editModel").value);if(!p)return;
  const prices={...(p.prices||{})};
  document.querySelectorAll("[data-issue]").forEach(el=>prices[ISSUES[Number(el.dataset.issue)]]=Number(el.value||0));
  try{
    await updateDoc(doc(db,"products",p.id),{prices,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
    await addDoc(collection(db,"priceLogs"),{productId:p.id,model:p.model,brand:p.brand,prices,changedBy:auth.currentUser.uid,changedAt:serverTimestamp()});
    $("saveResult").textContent="Đã lưu bảng giá.";await loadProducts();fillEditModels();toast("Đã cập nhật bảng giá.");
  }catch(e){console.error(e);$("saveResult").textContent="Không lưu được. Kiểm tra quyền Firestore."; }
};
$("addModel").onclick=async()=>{
  const brand=$("newBrand").value,model=$("newModel").value.trim();if(!model){toast("Hãy nhập tên dòng máy.");return;}
  try{await addDoc(collection(db,"products"),{brand,model,prices:{},createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});$("newModel").value="";await loadProducts();fillEditModels();toast("Đã thêm dòng máy.");}
  catch(e){console.error(e);toast("Không thêm được model. Kiểm tra quyền.");}
};
$("addStaff").onclick=async()=>{
  const email=$("staffEmail").value.trim(),password=$("staffPassword").value;
  if(!email||password.length<6){$("staffResult").textContent="Nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.";return;}
  try{
    const cred=await createUserWithEmailAndPassword(staffAuth,email,password);
    await setDoc(doc(db,"users",cred.user.uid),{email,role:"staff",createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});
    await signOut(staffAuth);
    $("staffResult").textContent="Đã tạo tài khoản nhân viên: "+email;
    $("staffPassword").value="";
  }catch(e){console.error(e);$("staffResult").textContent="Tạo tài khoản thất bại. Email có thể đã tồn tại hoặc cấu hình chưa đúng.";}
};

renderBrands();
loadProducts();
