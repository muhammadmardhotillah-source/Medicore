// Run in browser console:
// Delete junk patients

(async () => {
  const sb = window.__sb;
  
  // Find junk patients
  const { data: junk } = await sb.from('patients').select('id,nama,no_rm').or('nama.ilike.%acong%,nama.ilike.%as%,nama.ilike.%rrrr%');
  console.log('Junk found:', junk?.length);
  
  for (const p of junk) {
    console.log(`Deleting ${p.nama} (${p.id})...`);
    
    // Check EMR references
    const { data: emr } = await sb.from('emr').select('id').eq('patient_id', p.id).limit(1);
    if (emr && emr.length > 0) {
      await sb.from('emr').delete().eq('patient_id', p.id);
      console.log(`  Deleted ${emr.length} EMR records`);
    }
    
    const { error } = await sb.from('patients').delete().eq('id', p.id);
    if (error) console.error(`  Error: ${error.message}`);
    else console.log(`  ✅ Deleted`);
  }
  
  // Verify
  const { data: check } = await sb.from('patients').select('count', {count:'exact', head:true});
  console.log(`Total patients remaining: ${check?.count || '?'}`);
})();
