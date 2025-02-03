<script lang="ts">
    import type { PageServerData } from "./$types";
    
    let { data }: { data: PageServerData } = $props();
</script>

<h1>Hi, {data.id}!</h1>