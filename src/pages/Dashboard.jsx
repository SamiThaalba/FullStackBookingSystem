import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import Alert from "../components/Alert";
import { formatDate, money } from "../utils/format";
import { getAvatarsBucket, getSupabase } from "../lib/supabase";
import { removeSupabaseObjectByPublicUrl, uploadHotelCoverImage } from "../lib/supabaseStorage";
import { safeImageExtension, validateImageFile } from "../lib/imageUpload";
import {
    CashPaymentStrategy,
    CreditCardPaymentStrategy,
    PAYMENT_METHODS,
    PaymentContext,
    getPaymentStrategy,
} from "../strategies/paymentStrategies";

const emptyHotel = { name:"",description:"",address:"",cityId:"",phone:"",email:"" };
const HOTEL_TEXT_FIELDS_NO_IMAGE = ["name", "description", "address", "phone", "email"];
const emptyRoom  = { hotelId:"",name:"",description:"",capacity:2,inventoryCount:10,basePrice:95,amenities:"WiFi, Parking, Restaurant" };
const ROOM_PRESETS = {
    standard: () => ({ ...emptyRoom }),
    family: () => ({
        ...emptyRoom,
        name: "Family Room",
        description: "Great for families — more space, extra beds, kid-friendly setup.",
        capacity: 4,
        amenities: "WiFi, Parking, Breakfast, Crib (on request)",
        basePrice: 140,
    }),
};
const STATUS_STYLE = {
    CONFIRMED:{ background:"#d1fae5",color:"#065f46" },
    PENDING:  { background:"#fef3c7",color:"#92400e" },
    CANCELLED:{ background:"#fee2e2",color:"#991b1b" },
};
const TABS = ["Overview","Hotels","Bookings"];
const PAYMENT_LABELS = {
    [PAYMENT_METHODS.CARD]: "Credit card",
    [PAYMENT_METHODS.CASH]: "Cash",
};

export default function Dashboard() {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const [tab,setTab] = useState("Overview");
    const [hotelForm,setHotelForm] = useState(emptyHotel);
    const [showHotelForm,setShowHotelForm] = useState(false);
    const [roomForm,setRoomForm] = useState(emptyRoom);
    const [showRoomForm,setShowRoomForm] = useState(false);
    const [editingHotel,setEditingHotel] = useState(null);
    const [editHotelForm,setEditHotelForm] = useState({});
    const [editingRoom,setEditingRoom] = useState(null);
    const [editRoomForm,setEditRoomForm] = useState({});
    const [expandedHotelId,setExpandedHotelId] = useState(null);
    const [selectedHotelId,setSelectedHotelId] = useState("");
    const [successMsg,setSuccessMsg] = useState("");
    const [hotelCoverFile,setHotelCoverFile] = useState(null);
    const [editHotelCoverFile,setEditHotelCoverFile] = useState(null);
    const [editHotelImagePreviewUrl,setEditHotelImagePreviewUrl] = useState(null);
    const [hotelCreatePreviewUrl,setHotelCreatePreviewUrl] = useState(null);
    const [blockingHotelSave,setBlockingHotelSave] = useState(false);
    const [bookingPaymentMethods, setBookingPaymentMethods] = useState({});
    const [bookingPaymentFeedback, setBookingPaymentFeedback] = useState({});
    const editHotelImageInputRef = useRef(null);
    const createHotelImageInputRef = useRef(null);

    useLayoutEffect(() => {
        if (!editHotelCoverFile) {
            setEditHotelImagePreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(editHotelCoverFile);
        setEditHotelImagePreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [editHotelCoverFile]);

    useLayoutEffect(() => {
        if (!hotelCoverFile) {
            setHotelCreatePreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(hotelCoverFile);
        setHotelCreatePreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [hotelCoverFile]);

    const hotelsQuery = useQuery({
        queryKey:["my-hotels"],
        queryFn:() => bookingApi.getMyHotels(),
    });
    const hotels = hotelsQuery.data ?? [];

    const citiesQuery = useQuery({
        queryKey: ["cities", "all"],
        queryFn: () => bookingApi.listCities({}),
        staleTime: 120_000,
    });
    const cities = citiesQuery.data ?? [];

    const roomTypesQuery = useQuery({
        queryKey:["room-types",expandedHotelId],
        queryFn:() => bookingApi.getRoomTypes(expandedHotelId),
        enabled: expandedHotelId != null,
    });

    const upcomingQuery = useQuery({
        queryKey:["upcoming-bookings",selectedHotelId],
        queryFn:() => bookingApi.upcomingBookings(selectedHotelId ? Number(selectedHotelId) : undefined),
    });
    const upcoming = upcomingQuery.data ?? [];

    function flash(msg){ setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(""),4000); }

    const createHotel = useMutation({
        mutationFn:(p)=>bookingApi.createHotel(normalizeHotel(p)),
    });
    const updateHotel = useMutation({
        mutationFn:({id,payload})=>bookingApi.patchHotel(id,payload),
    });
    const deleteHotel = useMutation({
        mutationFn:bookingApi.deleteHotel,
        onSuccess:()=>{ flash("Hotel deleted."); queryClient.invalidateQueries({queryKey:["my-hotels"]}); },
    });
    const createRoom = useMutation({
        mutationFn:(p)=>bookingApi.createRoomType(normalizeRoom(p)),
        onSuccess:()=>{ setRoomForm(emptyRoom); setShowRoomForm(false); flash("Room type added."); queryClient.invalidateQueries({queryKey:["room-types",Number(roomForm.hotelId)]}); },
    });
    const updateRoom = useMutation({
        mutationFn:({id,payload})=>bookingApi.updateRoomType(id,normalizeRoom(payload)),
        onSuccess:()=>{ setEditingRoom(null); flash("Room type updated."); queryClient.invalidateQueries({queryKey:["room-types",expandedHotelId]}); },
    });
    const deleteRoom = useMutation({
        mutationFn:bookingApi.deleteRoomType,
        onSuccess:()=>{ flash("Room type deleted."); queryClient.invalidateQueries({queryKey:["room-types",expandedHotelId]}); },
    });
    const confirmBooking = useMutation({
        mutationFn:bookingApi.confirmBooking,
        onSuccess:()=>{ flash("Booking confirmed."); queryClient.invalidateQueries({queryKey:["upcoming-bookings"]}); },
    });
    const processBookingPayment = useMutation({
        mutationFn: async ({ bookingId, method }) => {
            const paymentContext = new PaymentContext(getPaymentStrategy(method));
            return paymentContext.executePayment({ bookingId, bookingApi });
        },
        onSuccess: (result, variables) => {
            setBookingPaymentFeedback((prev) => ({
                ...prev,
                [variables.bookingId]: { type: "success", message: result.message },
            }));
            flash(`${PAYMENT_LABELS[variables.method]} payment flow completed.`);
            queryClient.invalidateQueries({ queryKey: ["upcoming-bookings"] });
        },
        onError: (error, variables) => {
            setBookingPaymentFeedback((prev) => ({
                ...prev,
                [variables.bookingId]: { type: "error", message: error?.message || "Could not process payment." },
            }));
        },
    });

    function startEditHotel(h){
        setEditHotelCoverFile(null);
        setEditingHotel(h);
        setEditHotelForm({
            name: h.name ?? "",
            description: h.description ?? "",
            address: h.address ?? "",
            cityId: h.cityId != null ? String(h.cityId) : "",
            phone: h.phone ?? "",
            email: h.email ?? "",
        });
    }

    /** Patch payload without image (cover is updated via upload when the manager picks a new file). */
    function buildEditHotelPayload(form) {
        return {
            name: form.name,
            description: form.description,
            address: form.address,
            cityId: Number(form.cityId),
            phone: form.phone,
            email: form.email,
        };
    }

    /**
     * Upload to bucket under hotels/{hotelId}/..., PATCH hotel, then remove previous object in the same bucket.
     */
    async function replaceHotelCoverImage(hotelId, file, previousImageUrl, extraPatchFields) {
        const supabase = getSupabase();
        const bucket = getAvatarsBucket();
        if (!supabase) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
        const invalid = validateImageFile(file);
        if (invalid) throw new Error(invalid);
        const ext = safeImageExtension(file);
        let newUrl = null;
        try {
            newUrl = await uploadHotelCoverImage(supabase, bucket, hotelId, file, ext);
            const payload = { ...extraPatchFields, imageUrl: newUrl };
            await bookingApi.patchHotel(hotelId, payload);
        } catch (e) {
            if (newUrl) await removeSupabaseObjectByPublicUrl(supabase, newUrl, bucket);
            throw e;
        }
        if (previousImageUrl && previousImageUrl !== newUrl) {
            await removeSupabaseObjectByPublicUrl(supabase, previousImageUrl, bucket);
        }
    }

    async function submitCreateHotel(e) {
        e.preventDefault();
        setBlockingHotelSave(true);
        const normalized = normalizeHotel({
            ...hotelForm,
            imageUrl: "",
        });
        try {
            const created = await createHotel.mutateAsync(normalized);
            if (hotelCoverFile && created?.id) {
                await replaceHotelCoverImage(created.id, hotelCoverFile, null, {});
            }
            setHotelForm(emptyHotel);
            setHotelCoverFile(null);
            setShowHotelForm(false);
            flash("Hotel created.");
            queryClient.invalidateQueries({ queryKey: ["my-hotels"] });
        } catch (err) {
            flash(err?.message || "Could not create hotel.");
        } finally {
            setBlockingHotelSave(false);
        }
    }

    async function submitEditHotel() {
        if (!editingHotel) return;
        const id = editingHotel.id;
        const previousImageUrl = editingHotel.imageUrl ?? null;
        const basePayload = buildEditHotelPayload(editHotelForm);
        setBlockingHotelSave(true);
        try {
            if (editHotelCoverFile) {
                await replaceHotelCoverImage(id, editHotelCoverFile, previousImageUrl, basePayload);
            } else {
                await updateHotel.mutateAsync({ id, payload: basePayload });
            }
            setEditingHotel(null);
            setEditHotelCoverFile(null);
            flash("Hotel updated.");
            queryClient.invalidateQueries({ queryKey: ["my-hotels"] });
        } catch (err) {
            flash(err?.message || "Could not update hotel.");
        } finally {
            setBlockingHotelSave(false);
        }
    }
    function startEditRoom(r,hotelId){ setEditingRoom({...r,hotelId}); setEditRoomForm({hotelId:String(hotelId),name:r.name??"",description:r.description??"",capacity:r.capacity,inventoryCount:r.inventoryCount,basePrice:r.basePrice,amenities:(r.amenities??[]).join(", ")}); }
    function handleDeleteHotel(h){ if(!window.confirm(`Delete "${h.name}"?\n\nThis removes all room types and cannot be undone.`)) return; deleteHotel.mutate(h.id); }
    function handleDeleteRoom(r){ if(!window.confirm(`Delete room type "${r.name}"? This cannot be undone.`)) return; deleteRoom.mutate(r.id); }
    function toggleExpand(id){ setExpandedHotelId(p=>p===id?null:id); }
    function getBookingPaymentMethod(bookingId) {
        return bookingPaymentMethods[bookingId] ?? PAYMENT_METHODS.CARD;
    }
    function setBookingPaymentMethod(bookingId, method) {
        setBookingPaymentMethods((prev) => ({ ...prev, [bookingId]: method }));
    }
    async function handleBookingPayment(bookingId) {
        const method = getBookingPaymentMethod(bookingId);
        await processBookingPayment.mutateAsync({ bookingId, method });
    }

    const pendingCount   = upcoming.filter(b=>b.status==="PENDING").length;
    const confirmedCount = upcoming.filter(b=>b.status==="CONFIRMED").length;
    const anyError = [hotelsQuery,citiesQuery,upcomingQuery,createHotel,updateHotel,deleteHotel,createRoom,updateRoom,deleteRoom,confirmBooking,processBookingPayment].map(x=>x.error?.message).find(Boolean);

    return (
        <section className="container dashboard-page">
            <div className="section-heading">
                <p className="eyebrow">Business</p>
                <h1>Manager dashboard</h1>
                <p className="muted">Welcome back, <strong>{auth.user?.username}</strong>. Manage your hotels, rooms and bookings below.</p>
            </div>

            <Alert type="error">{anyError}</Alert>
            {successMsg && <Alert type="info">{successMsg}</Alert>}

            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:28}}>
                <StatCard label="Hotels" value={hotels.length} icon="🏨" />
                <StatCard label="Pending bookings" value={pendingCount} icon="⏳" highlight />
                <StatCard label="Confirmed upcoming" value={confirmedCount} icon="✅" />
            </div>

            {/* Tabs */}
            <div style={{display:"flex",gap:8,marginBottom:24,borderBottom:"2px solid var(--line)",paddingBottom:0}}>
                {TABS.map(t=>(
                    <button key={t} onClick={()=>setTab(t)} style={{border:"none",background:"none",padding:"10px 18px",fontWeight:800,fontSize:"0.93rem",cursor:"pointer",color:tab===t?"var(--purple)":"var(--muted)",borderBottom:tab===t?"3px solid var(--purple)":"3px solid transparent",marginBottom:-2,transition:"color 0.15s"}}>
                        {t}
                        {t==="Bookings"&&pendingCount>0&&<span style={{marginLeft:6,background:"#fbbf24",color:"#78350f",borderRadius:999,padding:"2px 7px",fontSize:"0.75rem"}}>{pendingCount}</span>}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {tab==="Overview"&&(
                <div className="dashboard-grid">
                    <div className="panel">
                        <h2 style={{marginTop:0,color:"var(--purple-dark)"}}>Quick actions</h2>
                        <div style={{display:"grid",gap:10}}>
                            {auth.hasPermission("hotel:create")&&<button className="btn btn-teal btn-full" onClick={()=>{setTab("Hotels");setShowHotelForm(true);}}>+ Create hotel</button>}
                            {hotels.length>0&&<button className="btn btn-outline btn-full" onClick={()=>{setTab("Hotels");setShowRoomForm(true);}}>+ Add room type</button>}
                            <button className="btn btn-outline btn-full" onClick={()=>setTab("Bookings")}>View bookings {pendingCount>0&&`(${pendingCount} pending)`}</button>
                        </div>
                    </div>
                    <div className="panel">
                        <h2 style={{marginTop:0,color:"var(--purple-dark)"}}>My hotels</h2>
                        {hotelsQuery.isLoading&&<p className="muted">Loading…</p>}
                        {!hotelsQuery.isLoading&&hotels.length===0&&<p className="muted">No hotels yet — create one to get started.</p>}
                        <div style={{display:"grid",gap:8}}>
                            {hotels.slice(0,5).map(h=>(
                                <div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",border:"1px solid var(--line)",borderRadius:10}}>
                                    <span style={{fontWeight:700}}>{h.name}</span>
                                    <span className="muted" style={{fontSize:"0.82rem"}}>{h.city}, {h.country}</span>
                                </div>
                            ))}
                            {hotels.length>5&&<button className="btn btn-outline btn-small" onClick={()=>setTab("Hotels")}>View all {hotels.length} hotels →</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* ── HOTELS ── */}
            {tab==="Hotels"&&(
                <div>
                    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                        {auth.hasPermission("hotel:create")&&<button className="btn btn-teal btn-small" onClick={()=>{setShowHotelForm(v=>!v);setShowRoomForm(false);}}>{showHotelForm?"✕ Cancel":"+ New hotel"}</button>}
                        {hotels.length>0&&<button className="btn btn-outline btn-small" onClick={()=>{setShowRoomForm(v=>!v);setShowHotelForm(false);}}>{showRoomForm?"✕ Cancel":"+ Add room type"}</button>}
                    </div>

                    {showHotelForm&&auth.hasPermission("hotel:create")&&(
                        <div className="panel" style={{marginBottom:24}}>
                            <h3 style={{marginTop:0,color:"var(--purple-dark)"}}>Create hotel</h3>
                            <form className="modal-grid" style={{gap:14}} onSubmit={submitCreateHotel}>
                                {HOTEL_TEXT_FIELDS_NO_IMAGE.map((field)=>(
                                    <label key={field} style={field==="description"?{gridColumn:"1/-1"}:{}}>
                                        {labelFor(field)}
                                        <input type={field==="email"?"email":"text"} value={hotelForm[field]} placeholder={`Enter ${labelFor(field).toLowerCase()}`} onChange={e=>setHotelForm({...hotelForm,[field]:e.target.value})} required={["name","address"].includes(field)} />
                                    </label>
                                ))}
                                <div className="dashboard-hotel-image-block">
                                    <span style={{display:"block",fontWeight:800,fontSize:"0.78rem",textTransform:"uppercase",letterSpacing:"0.05em",color:"var(--muted)",marginBottom:8}}>Hotel image</span>
                                    <input ref={createHotelImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="visually-hidden" onChange={(e)=>{ setHotelCoverFile(e.target.files?.[0]||null); e.target.value=""; }} disabled={blockingHotelSave||createHotel.isPending} />
                                    <div className="dashboard-hotel-image-preview-wrap">
                                        {hotelCreatePreviewUrl ? (
                                            <img className="dashboard-hotel-image-preview" src={hotelCreatePreviewUrl} alt="" />
                                        ) : (
                                            <div className="dashboard-hotel-image-placeholder">No image yet — optional</div>
                                        )}
                                    </div>
                                    <div className="dashboard-hotel-image-actions">
                                        <button type="button" className="btn btn-outline btn-small" disabled={blockingHotelSave||createHotel.isPending} onClick={()=>createHotelImageInputRef.current?.click()}>{hotelCoverFile ? "Change image" : "Choose image"}</button>
                                        {hotelCoverFile ? (
                                            <button type="button" className="btn btn-outline btn-small" disabled={blockingHotelSave||createHotel.isPending} onClick={()=>setHotelCoverFile(null)}>Clear</button>
                                        ) : null}
                                    </div>
                                    {hotelCoverFile ? <p className="muted" style={{margin:"8px 0 0",fontSize:"0.82rem"}}>Saved to the database after you create the hotel (uploads to your Supabase bucket).</p> : null}
                                </div>
                                <label style={{gridColumn:"1/-1"}}>
                                    City
                                    <select value={hotelForm.cityId} onChange={(e)=>setHotelForm({...hotelForm,cityId:e.target.value})} required disabled={citiesQuery.isLoading}>
                                        <option value="">{citiesQuery.isLoading ? "Loading cities…" : "Select city"}</option>
                                        {cities.map((c)=>(
                                            <option key={c.id} value={c.id}>{c.name} — {c.countryName}</option>
                                        ))}
                                    </select>
                                </label>
                                <div style={{gridColumn:"1/-1",display:"flex",gap:10}}>
                                    <button className="btn btn-teal" disabled={blockingHotelSave||createHotel.isPending}>{blockingHotelSave||createHotel.isPending?"Creating…":"Create hotel"}</button>
                                    <button type="button" className="btn btn-outline" onClick={()=>{setShowHotelForm(false);setHotelCoverFile(null);}}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {showRoomForm&&(
                        <div className="panel" style={{marginBottom:24}}>
                            <h3 style={{marginTop:0,color:"var(--purple-dark)"}}>Add room type</h3>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                                <button
                                    type="button"
                                    className="btn btn-outline btn-small"
                                    onClick={()=>setRoomForm((current)=>({ ...ROOM_PRESETS.standard(), hotelId: current.hotelId }))}
                                >
                                    Standard preset
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline btn-small"
                                    onClick={()=>setRoomForm((current)=>({ ...ROOM_PRESETS.family(), hotelId: current.hotelId }))}
                                >
                                    Family preset
                                </button>
                            </div>
                            <form className="modal-grid" style={{gap:14}} onSubmit={e=>{e.preventDefault();createRoom.mutate(roomForm);}}>
                                <label style={{gridColumn:"1/-1"}}>
                                    Hotel
                                    <select value={roomForm.hotelId} onChange={e=>setRoomForm({...roomForm,hotelId:e.target.value})} required>
                                        <option value="">Select hotel</option>
                                        {hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
                                    </select>
                                </label>
                                {Object.keys(emptyRoom).filter(f=>f!=="hotelId").map(field=>(
                                    <label key={field} style={field==="description"||field==="amenities"?{gridColumn:"1/-1"}:{}}>
                                        {labelFor(field)}
                                        <input type={["capacity","inventoryCount","basePrice"].includes(field)?"number":"text"} value={roomForm[field]} placeholder={field==="amenities"?"WiFi, Parking, Pool":`Enter ${labelFor(field).toLowerCase()}`} onChange={e=>setRoomForm({...roomForm,[field]:e.target.value})} required min={["capacity","inventoryCount"].includes(field)?1:undefined} step={field==="basePrice"?"0.01":undefined} />
                                    </label>
                                ))}
                                <div style={{gridColumn:"1/-1",display:"flex",gap:10}}>
                                    <button className="btn btn-teal" disabled={createRoom.isPending}>{createRoom.isPending?"Adding…":"Add room type"}</button>
                                    <button type="button" className="btn btn-outline" onClick={()=>setShowRoomForm(false)}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {hotelsQuery.isLoading&&<p className="muted">Loading hotels…</p>}
                    {!hotelsQuery.isLoading&&hotels.length===0&&(
                        <div className="empty-state">
                            <p style={{fontSize:"2rem",margin:"0 0 8px"}}>🏨</p>
                            <p style={{fontWeight:700,color:"var(--purple-dark)"}}>No hotels yet</p>
                            <p className="muted">Click "+ New hotel" above to create your first hotel.</p>
                        </div>
                    )}

                    <div style={{display:"grid",gap:16}}>
                        {hotels.map(hotel=>(
                            <div key={hotel.id} className="panel" style={{padding:0,overflow:"hidden"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px",gap:14,flexWrap:"wrap"}}>
                                    <div>
                                        <div style={{fontWeight:800,fontSize:"1.05rem",color:"var(--purple-dark)"}}>{hotel.name}</div>
                                        <div className="muted" style={{fontSize:"0.85rem",marginTop:2}}>{[hotel.address,hotel.city,hotel.country].filter(Boolean).join(", ")}{hotel.phone&&` · ${hotel.phone}`}</div>
                                        {hotel.email&&<div className="muted" style={{fontSize:"0.82rem"}}>{hotel.email}</div>}
                                    </div>
                                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                        <button className="btn btn-small btn-outline" onClick={()=>toggleExpand(hotel.id)}>{expandedHotelId===hotel.id?"Hide rooms ▲":"Rooms ▼"}</button>
                                        {auth.hasPermission("hotel:update")&&<button className="btn btn-small btn-outline" onClick={()=>startEditHotel(hotel)}>✏️ Edit</button>}
                                        {auth.hasPermission("hotel:delete")&&<button className="btn btn-small btn-outline" style={{color:"#9b1c1c",borderColor:"#ffd1d1"}} disabled={deleteHotel.isPending} onClick={()=>handleDeleteHotel(hotel)}>🗑 Delete</button>}
                                    </div>
                                </div>

                                {expandedHotelId===hotel.id&&(
                                    <div style={{borderTop:"1px solid var(--line)",background:"#faf9fb",padding:"16px 20px"}}>
                                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                                            <span style={{fontWeight:700,color:"var(--muted)",fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>Room types</span>
                                            {auth.hasPermission("room:create")&&<button className="btn btn-small btn-teal" onClick={()=>{setRoomForm({...emptyRoom,hotelId:String(hotel.id)});setShowRoomForm(true);setShowHotelForm(false);window.scrollTo({top:0,behavior:"smooth"});}}>+ Add room</button>}
                                        </div>
                                        {roomTypesQuery.isLoading&&expandedHotelId===hotel.id&&<p className="muted">Loading rooms…</p>}
                                        {!roomTypesQuery.isLoading&&(roomTypesQuery.data??[]).length===0&&<p className="muted" style={{fontSize:"0.9rem"}}>No room types added yet.</p>}
                                        <div style={{display:"grid",gap:10}}>
                                            {(roomTypesQuery.data??[]).map(room=>(
                                                <div key={room.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",border:"1px solid var(--line)",borderRadius:12,padding:"14px 16px",gap:12,flexWrap:"wrap"}}>
                                                    <div>
                                                        <div style={{fontWeight:700}}>{room.name}</div>
                                                        <div className="muted" style={{fontSize:"0.82rem",marginTop:2}}>{money(room.basePrice)} / night · {room.inventoryCount} rooms · {room.capacity} guests max</div>
                                                        {room.amenities?.length>0&&<div className="muted" style={{fontSize:"0.78rem",marginTop:3}}>{room.amenities.join(" · ")}</div>}
                                                    </div>
                                                    <div style={{display:"flex",gap:8}}>
                                                        {auth.hasPermission("room:update")&&<button className="btn btn-small btn-outline" onClick={()=>startEditRoom(room,hotel.id)}>✏️ Edit</button>}
                                                        {auth.hasPermission("room:delete")&&<button className="btn btn-small btn-outline" style={{color:"#9b1c1c",borderColor:"#ffd1d1"}} disabled={deleteRoom.isPending} onClick={()=>handleDeleteRoom(room)}>🗑 Delete</button>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── BOOKINGS ── */}
            {tab==="Bookings"&&(
                <div>
                    {hotels.length>0&&(
                        <div style={{marginBottom:20,maxWidth:360}}>
                            <label>Filter by hotel
                                <select value={selectedHotelId} onChange={e=>setSelectedHotelId(e.target.value)}>
                                    <option value="">All my hotels</option>
                                    {hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </label>
                        </div>
                    )}
                    {upcomingQuery.isLoading&&<p className="muted">Loading bookings…</p>}
                    {!upcomingQuery.isLoading&&upcoming.length===0&&(
                        <div className="empty-state">
                            <p style={{fontSize:"2rem",margin:"0 0 8px"}}>📅</p>
                            <p style={{fontWeight:700,color:"var(--purple-dark)"}}>No upcoming bookings</p>
                            <p className="muted">Bookings will appear here once guests make reservations.</p>
                        </div>
                    )}
                    <div style={{display:"grid",gap:14}}>
                        {upcoming.map(booking=>{
                            const hotelName = hotels.find(h=>h.id===booking.hotelId)?.name??`Hotel #${booking.hotelId}`;
                            const statusStyle = STATUS_STYLE[booking.status]??{};
                            const selectedPaymentMethod = getBookingPaymentMethod(booking.id);
                            const bookingFeedback = bookingPaymentFeedback[booking.id];
                            const isPayingThisBooking = processBookingPayment.isPending && processBookingPayment.variables?.bookingId === booking.id;
                            return (
                                <div key={booking.id} style={{display:"grid",gridTemplateColumns:"minmax(250px,1fr) minmax(280px,1fr)",padding:"18px 20px",border:"1px solid var(--line)",borderRadius:16,background:"#fff",gap:16}}>
                                    <div style={{display:"grid",gap:6}}>
                                        <div style={{fontWeight:800,color:"var(--purple-dark)"}}>{hotelName}<span className="muted" style={{fontWeight:400,fontSize:"0.85rem",marginLeft:8}}>Booking #{booking.id}</span></div>
                                        <div className="muted" style={{fontSize:"0.85rem"}}>📅 {formatDate(booking.startDate)} → {formatDate(booking.endDate)}</div>
                                        <div className="muted" style={{fontSize:"0.82rem"}}>Room #{booking.roomTypeId} · Guest #{booking.guestId}</div>
                                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginTop:2}}>
                                            <span style={{fontWeight:800,color:"var(--purple)",fontSize:"1.05rem"}}>{money(booking.totalPrice)}</span>
                                            <span style={{...statusStyle,borderRadius:999,padding:"5px 12px",fontWeight:800,fontSize:"0.8rem"}}>{booking.status}</span>
                                        </div>
                                    </div>
                                    <div style={{display:"grid",gap:10,padding:"12px",border:"1px solid #ece7f8",borderRadius:12,background:"#faf8ff"}}>
                                        <div style={{display:"grid",gap:8}}>
                                            <div style={{fontSize:"0.75rem",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--muted)"}}>Payment method</div>
                                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                                <button
                                                    type="button"
                                                    className="btn btn-small btn-outline"
                                                    onClick={()=>setBookingPaymentMethod(booking.id, PAYMENT_METHODS.CARD)}
                                                    style={selectedPaymentMethod===PAYMENT_METHODS.CARD?{background:"#ede9fe",borderColor:"#c4b5fd",color:"#4c1d95"}:{}}
                                                    disabled={isPayingThisBooking}
                                                >
                                                    {PAYMENT_LABELS[PAYMENT_METHODS.CARD]}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-small btn-outline"
                                                    onClick={()=>setBookingPaymentMethod(booking.id, PAYMENT_METHODS.CASH)}
                                                    style={selectedPaymentMethod===PAYMENT_METHODS.CASH?{background:"#dcfce7",borderColor:"#86efac",color:"#166534"}:{}}
                                                    disabled={isPayingThisBooking}
                                                >
                                                    {PAYMENT_LABELS[PAYMENT_METHODS.CASH]}
                                                </button>
                                            </div>
                                            <p className="muted" style={{margin:0,fontSize:"0.8rem"}}>
                                                {selectedPaymentMethod===PAYMENT_METHODS.CARD
                                                    ? "Card strategy: create and immediately process online payment."
                                                    : "Cash strategy: register payment request and collect cash at check-in."}
                                            </p>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                                            <button
                                                type="button"
                                                className="btn btn-small btn-teal"
                                                disabled={isPayingThisBooking}
                                                onClick={()=>handleBookingPayment(booking.id)}
                                            >
                                                {isPayingThisBooking ? "Processing…" : "Process payment"}
                                            </button>
                                            {bookingFeedback?.message ? (
                                                <span style={{fontSize:"0.8rem",fontWeight:700,color:bookingFeedback.type==="error"?"#9b1c1c":"#065f46"}}>
                                                    {bookingFeedback.message}
                                                </span>
                                            ) : null}
                                        </div>
                                        {booking.status==="PENDING"&&auth.hasPermission("booking:update")&&(
                                            <button className="btn btn-small btn-teal" disabled={confirmBooking.isPending} onClick={()=>confirmBooking.mutate(booking.id)}>{confirmBooking.isPending?"…":"Confirm"}</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── EDIT HOTEL MODAL ── */}
            {editingHotel&&(
                <div className="modal-backdrop" onClick={()=>{setEditingHotel(null);setEditHotelCoverFile(null);}}>
                    <div className="modal modal--scrollable" onClick={e=>e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>Edit hotel</h2>
                            <button type="button" style={{border:"none",background:"none",fontSize:"1.4rem",cursor:"pointer",color:"var(--muted)"}} aria-label="Close" onClick={()=>{setEditingHotel(null);setEditHotelCoverFile(null);}}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-grid" style={{gap:14}}>
                                {HOTEL_TEXT_FIELDS_NO_IMAGE.map((field)=>(
                                    <label key={field} style={field==="description"?{gridColumn:"1/-1"}:{}}>
                                        {labelFor(field)}
                                        <input type={field==="email"?"email":"text"} value={editHotelForm[field] ?? ""} onChange={(e)=>setEditHotelForm({...editHotelForm,[field]:e.target.value})} />
                                    </label>
                                ))}
                                <div className="dashboard-hotel-image-block">
                                    <span style={{display:"block",fontWeight:800,fontSize:"0.78rem",textTransform:"uppercase",letterSpacing:"0.05em",color:"var(--muted)",marginBottom:8}}>Hotel image</span>
                                    <input ref={editHotelImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="visually-hidden" onChange={(e)=>{ setEditHotelCoverFile(e.target.files?.[0]||null); e.target.value=""; }} disabled={blockingHotelSave||updateHotel.isPending} />
                                    <div className="dashboard-hotel-image-preview-wrap">
                                        {editHotelImagePreviewUrl || editingHotel.imageUrl ? (
                                            <img className="dashboard-hotel-image-preview" src={editHotelImagePreviewUrl || editingHotel.imageUrl} alt="" />
                                        ) : (
                                            <div className="dashboard-hotel-image-placeholder">No hotel image</div>
                                        )}
                                    </div>
                                    <div className="dashboard-hotel-image-actions">
                                        <button type="button" className="btn btn-outline btn-small" disabled={blockingHotelSave||updateHotel.isPending} onClick={()=>editHotelImageInputRef.current?.click()}>Change image</button>
                                        {editHotelCoverFile ? (
                                            <button type="button" className="btn btn-outline btn-small" disabled={blockingHotelSave||updateHotel.isPending} onClick={()=>setEditHotelCoverFile(null)}>Revert to current</button>
                                        ) : null}
                                    </div>
                                </div>
                                <label style={{gridColumn:"1/-1"}}>
                                    City
                                    <select value={editHotelForm.cityId ?? ""} onChange={(e)=>setEditHotelForm({...editHotelForm,cityId:e.target.value})} disabled={citiesQuery.isLoading} required>
                                        <option value="" disabled>Select city</option>
                                        {cities.map((c)=>(
                                            <option key={c.id} value={c.id}>{c.name} — {c.countryName}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-teal" disabled={blockingHotelSave||updateHotel.isPending} onClick={submitEditHotel}>{blockingHotelSave||updateHotel.isPending?"Saving…":"Save changes"}</button>
                            <button type="button" className="btn btn-outline" onClick={()=>{setEditingHotel(null);setEditHotelCoverFile(null);}}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EDIT ROOM MODAL ── */}
            {editingRoom&&(
                <div className="modal-backdrop" onClick={()=>setEditingRoom(null)}>
                    <div className="modal" onClick={e=>e.stopPropagation()}>
                        <div className="modal-head" style={{marginBottom:20}}>
                            <h2>Edit room type</h2>
                            <button style={{border:"none",background:"none",fontSize:"1.4rem",cursor:"pointer",color:"var(--muted)"}} onClick={()=>setEditingRoom(null)}>✕</button>
                        </div>
                        <div className="modal-grid" style={{gap:14}}>
                            {Object.keys(emptyRoom).filter(f=>f!=="hotelId").map(field=>(
                                <label key={field} style={field==="description"||field==="amenities"?{gridColumn:"1/-1"}:{}}>
                                    {labelFor(field)}
                                    <input type={["capacity","inventoryCount","basePrice"].includes(field)?"number":"text"} value={editRoomForm[field]??""} onChange={e=>setEditRoomForm({...editRoomForm,[field]:e.target.value})} min={["capacity","inventoryCount"].includes(field)?1:undefined} step={field==="basePrice"?"0.01":undefined} />
                                </label>
                            ))}
                        </div>
                        <div style={{display:"flex",gap:10,marginTop:20}}>
                            <button className="btn btn-teal" disabled={updateRoom.isPending} onClick={()=>updateRoom.mutate({id:editingRoom.id,payload:editRoomForm})}>{updateRoom.isPending?"Saving…":"Save changes"}</button>
                            <button className="btn btn-outline" onClick={()=>setEditingRoom(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function StatCard({label,value,icon,highlight}){
    return (
        <div style={{padding:"20px 24px",border:`1px solid ${highlight?"#fde68a":"var(--line)"}`,borderRadius:16,background:highlight?"#fffbeb":"#fff",boxShadow:"0 4px 14px rgba(47,24,68,0.06)"}}>
            <div style={{fontSize:"1.6rem",marginBottom:6}}>{icon}</div>
            <div style={{fontSize:"2rem",fontWeight:900,color:highlight?"#92400e":"var(--purple-dark)"}}>{value}</div>
            <div style={{color:"var(--muted)",fontSize:"0.85rem",fontWeight:700}}>{label}</div>
        </div>
    );
}

function normalizeHotel(payload){
    const {managerId:_,...rest}=payload;
    const cityId = Number(rest.cityId);
    return {
        ...rest,
        imageUrl: rest.imageUrl ?? "",
        cityId: Number.isFinite(cityId) && cityId > 0 ? cityId : undefined,
    };
}
function normalizeRoom(payload){
    return {...payload,hotelId:Number(payload.hotelId),capacity:Number(payload.capacity),inventoryCount:Number(payload.inventoryCount),basePrice:Number(payload.basePrice),amenities:String(payload.amenities??"").split(",").map(s=>s.trim()).filter(Boolean)};
}
function labelFor(field){
    return field.replace(/([A-Z])/g," $1").replace(/^./,l=>l.toUpperCase());
}